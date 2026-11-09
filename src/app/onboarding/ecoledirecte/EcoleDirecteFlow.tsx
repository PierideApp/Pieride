import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button/Button";
import { InfoCard } from "@/components/InfoCard/InfoCard";
import { Spinner } from "@/components/Spinner/Spinner";
import { TextField } from "@/components/TextField/TextField";
import { accountManager } from "@/services";
import type { SyncedCapability } from "@/services/account-manager";
import {
  type EcoledirecteLogin,
  loginEcoledirecte,
  type TwoFactorChallenge,
} from "@/services/ecoledirecte/session";
import { useAccountStore } from "@/stores/accounts";
import { useSyncStore } from "@/stores/sync";

import { BackButton } from "../BackButton";
import styles from "../onboarding.module.scss";
import flow from "./ecoledirecte.module.scss";

export interface EcoledirecteRelink {
  kind: "ecoledirecte";
  accountId: string;
  serviceId: string;
}

type Phase = "credentials" | "challenge" | "syncing";
const SYNC_STEPS = [
  "TIMETABLE",
  "GRADES",
  "HOMEWORK",
] as const satisfies readonly SyncedCapability[];

function errorKey(error: unknown): string {
  const name = error instanceof Error ? error.name : String(error);
  if (name === "AuthenticationError") {
    return "onboarding.ecoledirecte.errors.AuthenticationError";
  }
  if (name === "ServiceUnavailable") {
    return "onboarding.ecoledirecte.errors.ServiceUnavailable";
  }
  if (name === "SecurityChallenge") {
    return "onboarding.ecoledirecte.errors.SecurityChallenge";
  }
  if (name === "InvalidSecurityAnswer") {
    return "onboarding.ecoledirecte.errors.InvalidSecurityAnswer";
  }
  if (name === "keyring_unavailable") {
    return "errors.keyring_unavailable";
  }
  return "errors.Unknown";
}

export function EcoledirecteFlow({
  relink,
  onExit,
  onDone,
}: {
  relink?: EcoledirecteRelink;
  onExit: () => void;
  onDone?: () => void;
}) {
  const { t } = useTranslation();
  const setCurrentAccount = useAccountStore(state => state.setCurrentAccount);
  const reload = useSyncStore(state => state.reload);
  const sync = useSyncStore(state => state.sync);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [answer, setAnswer] = useState("");
  const [phase, setPhase] = useState<Phase>("credentials");
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null);
  const [error, setError] = useState<string | null>(null);

  const complete = async (login: EcoledirecteLogin) => {
    setPhase("syncing");
    const accountId = relink?.accountId ?? crypto.randomUUID();
    const secret = JSON.stringify(login.secret);
    if (relink) {
      await accountManager.relinkService(relink.serviceId, secret);
    } else {
      const profile = login.account;
      await accountManager.addAccount({
        id: accountId,
        firstName: profile.prenom,
        lastName: profile.nom,
        schoolName: profile.nomEtablissement || undefined,
        className: profile.profile.classe?.libelle || undefined,
      });
      try {
        await accountManager.linkService(
          {
            id: crypto.randomUUID(),
            accountId,
            kind: "ecoledirecte",
          },
          secret
        );
      } catch (failure) {
        await accountManager.removeAccount(accountId);
        throw failure;
      }
    }
    for (const capability of SYNC_STEPS) {
      await accountManager.refresh(accountId, capability);
    }
    setCurrentAccount(accountId);
    reload();
    void sync(accountId);
    onDone?.();
  };

  const submitCredentials = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPhase("syncing");
    try {
      const result = await loginEcoledirecte(username, password);
      if (result.kind === "challenge") {
        setChallenge(result.challenge);
        setAnswer("");
        setPassword("");
        setPhase("challenge");
      } else {
        setPassword("");
        await complete(result.login);
      }
    } catch (failure) {
      setPhase("credentials");
      setError(errorKey(failure));
    }
  };

  const submitAnswer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!challenge) {
      return;
    }
    setError(null);
    setPhase("syncing");
    try {
      // Le mot de passe est gardé uniquement dans la fermeture de la demande de vérification.
      const result = await challenge.finish(answer);
      setChallenge(null);
      await complete(result);
    } catch (failure) {
      setPhase("challenge");
      setError(errorKey(failure));
    }
  };

  const message = error && (
    <p className={styles.error} role="alert">
      {t(error)}
    </p>
  );

  if (phase === "syncing") {
    return (
      <div className={styles.step}>
        <h1 className={styles.title}>
          {t("onboarding.ecoledirecte.syncTitle")}
        </h1>
        <p className={styles.text}>{t("onboarding.ecoledirecte.syncText")}</p>
        <Spinner size="large" label={t("onboarding.ecoledirecte.syncTitle")} />
      </div>
    );
  }

  return (
    <>
      <BackButton
        onClick={() => {
          if (phase === "challenge") {
            setChallenge(null);
            setError(null);
            setPhase("credentials");
          } else {
            onExit();
          }
        }}
      />
      <form
        className={styles.step}
        onSubmit={phase === "challenge" ? submitAnswer : submitCredentials}
      >
        <p className={styles.eyebrow}>{t("onboarding.ecoledirecte.eyebrow")}</p>
        <h1 className={styles.title}>
          {t(
            phase === "challenge"
              ? "onboarding.ecoledirecte.challengeTitle"
              : "onboarding.ecoledirecte.loginTitle"
          )}
        </h1>
        <p className={styles.text}>
          {t(
            phase === "challenge"
              ? "onboarding.ecoledirecte.challengeText"
              : "onboarding.ecoledirecte.loginText"
          )}
        </p>

        {phase === "challenge" && challenge ? (
          <fieldset className={flow.options}>
            <legend className={flow.question}>{challenge.question}</legend>
            {challenge.propositions.map(proposition => (
              <label className={flow.option} key={proposition}>
                <input
                  type="radio"
                  name="ecoledirecte-answer"
                  value={proposition}
                  checked={answer === proposition}
                  onChange={() => setAnswer(proposition)}
                />
                <span>{proposition}</span>
              </label>
            ))}
          </fieldset>
        ) : (
          <div className={flow.fields}>
            <TextField
              size="large"
              label={t("onboarding.ecoledirecte.username")}
              autoComplete="username"
              autoCapitalize="none"
              value={username}
              onChange={event => setUsername(event.target.value)}
              required
              autoFocus
            />
            <TextField
              size="large"
              label={t("onboarding.ecoledirecte.password")}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              required
            />
            <InfoCard title={t("onboarding.ecoledirecte.privacyTitle")}>
              <p>{t("onboarding.ecoledirecte.privacyText")}</p>
            </InfoCard>
          </div>
        )}

        {message}
        <footer className={styles.footer}>
          <Button
            type="submit"
            variant="primary"
            size="large"
            disabled={
              phase === "challenge" ? !answer : !username.trim() || !password
            }
          >
            {t(
              phase === "challenge"
                ? "onboarding.ecoledirecte.confirm"
                : "onboarding.ecoledirecte.connect"
            )}
          </Button>
        </footer>
      </form>
    </>
  );
}
