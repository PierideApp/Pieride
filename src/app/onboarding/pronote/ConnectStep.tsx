// Connexion à l'établissement choisi : la page de PRONOTE (ou de l'ENT) s'ouvre dans une
// fenêtre à part (maquette 08), puis le code PIN si PRONOTE le demande, puis la première
// synchro (maquette 15-connexion-en-cours). Crée le compte, ou reconnecte un service refusé.
import { Check } from "@getpapillon/papicons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button/Button";
import { Card } from "@/components/Card/Card";
import { InfoCard } from "@/components/InfoCard/InfoCard";
import { SettingRow } from "@/components/SettingRow/SettingRow";
import { Spinner } from "@/components/Spinner/Spinner";
import { TextField } from "@/components/TextField/TextField";
import { accountManager } from "@/services";
import type { SyncedCapability } from "@/services/account-manager";
import {
  closeEntLogin,
  loadPhoto,
  loginWithEnt,
  loginDemo,
  openEntLogin,
  type PronoteLogin,
  WrongPin,
} from "@/services/pronote/login";
import { useAccountStore } from "@/stores/accounts";
import { useSyncStore } from "@/stores/sync";

import { BackButton } from "../BackButton";
import styles from "../onboarding.module.scss";
import { errorKey } from "./errors";
import pronote from "./pronote.module.scss";

/** Un service à reconnecter (Paramètres > Comptes liés). */
export interface Relink {
  accountId: string;
  serviceId: string;
  url: string;
  name: string;
}

type Phase =
  | { id: "ready" }
  | { id: "waiting" }
  | { id: "pin"; finish: (pin: string) => Promise<PronoteLogin> }
  /** `done` : le nombre d'étapes terminées, la connexion comprise. */
  | { id: "syncing"; done: number };

/** Dans l'ordre de la maquette. Les autres données suivent juste après, en arrière-plan. */
const SYNC_STEPS = [
  "TIMETABLE",
  "GRADES",
  "HOMEWORK",
] as const satisfies readonly SyncedCapability[];

export function ConnectStep({
  school,
  relink,
  onBack,
  onDone,
}: {
  school: { url: string; name: string };
  relink?: Relink;
  onBack: () => void;
  onDone?: () => void;
}) {
  const { t } = useTranslation();
  const setCurrentAccount = useAccountStore(state => state.setCurrentAccount);
  const reload = useSyncStore(state => state.reload);
  const sync = useSyncStore(state => state.sync);
  // Le jeton de PRONOTE ne vaut que pour cet identifiant d'appareil.
  const [deviceUUID] = useState(() => crypto.randomUUID());
  const [phase, setPhase] = useState<Phase>({ id: "ready" });
  /** Clé i18n du dernier échec. */
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState("");

  // Quitter l'étape (Retour, fenêtre des Paramètres fermée) ferme aussi la page de connexion.
  useEffect(() => () => void closeEntLogin(), []);

  useEffect(() => () => {
    if(school.url === "https://demo.index-education.net/pronote") loginWithDemo();
  }, [])

  const fail = (failure: unknown) => {
    setPhase({ id: "ready" });
    setError(errorKey(failure));
  };

  /** Crée le compte (ou remplace le secret du service refusé), puis la première synchro. */
  const complete = async (login: PronoteLogin) => {
    setPhase({ id: "syncing", done: 1 });
    const secret = JSON.stringify(login.secret);
    const accountId = relink?.accountId ?? crypto.randomUUID();
    if (relink) {
      await accountManager.relinkService(relink.serviceId, secret);
    } else {
      const avatar = login.photoUrl && (await loadPhoto(login.photoUrl));
      await accountManager.addAccount({
        id: accountId,
        ...login.profile,
        avatar: avatar || undefined,
      });
      try {
        await accountManager.linkService(
          {
            id: crypto.randomUUID(),
            accountId,
            kind: "pronote",
            instanceUrl: login.secret.url,
          },
          secret
        );
      } catch (failure) {
        // Pas de compte PRONOTE sans son secret.
        await accountManager.removeAccount(accountId);
        throw failure;
      }
    }
    for (const [index, capability] of SYNC_STEPS.entries()) {
      setPhase({ id: "syncing", done: index + 1 });
      await accountManager.refresh(accountId, capability);
    }
    setCurrentAccount(accountId);
    reload();
    // Actualités, carnet… : une synchro complète, qui ne redemande pas les étapes ci-dessus
    // (moins de 30 minutes). Sans elle, ils attendraient un clic sur « Synchroniser ».
    void sync(accountId);
    onDone?.();
  };

  const open = async () => {
    setError(null);
    setPhase({ id: "waiting" });
    try {
      const credentials = await openEntLogin(
        school.url,
        deviceUUID,
        t("onboarding.pronote.windowTitle")
      );
      if (!credentials) {
        setPhase({ id: "ready" });
        setError("onboarding.pronote.closed");
        return;
      }
      setPhase({ id: "syncing", done: 0 });
      const result = await loginWithEnt(school.url, credentials, deviceUUID);
      if (result.kind === "pin") {
        setPhase({ id: "pin", finish: result.finish });
      } else {
        await complete(result.login);
      }
    } catch (failure) {
      fail(failure);
    }
  };

  const loginWithDemo = async() => {
    setPhase({ id: "syncing", done: 0 });
    try {
      const result = await loginDemo();
      await complete(result.login)
    }
    catch (failure) {
      fail(failure);
    }
  }

  const confirmPin = async (finish: (pin: string) => Promise<PronoteLogin>) => {
    setError(null);
    setPhase({ id: "syncing", done: 0 });
    let login: PronoteLogin;
    try {
      login = await finish(pin);
    } catch (failure) {
      if (failure instanceof WrongPin) {
        setPhase({ id: "pin", finish });
        setError(errorKey(failure));
      } else {
        fail(failure);
      }
      return;
    }
    try {
      await complete(login);
    } catch (failure) {
      fail(failure);
    }
  };

  const message = error && (
    <p className={styles.error} role="alert">
      {t(error)}
    </p>
  );

  if (phase.id === "syncing") {
    const steps = ["login", ...SYNC_STEPS] as const;
    return (
      <div className={styles.step}>
        <h1 className={styles.title}>{t("onboarding.pronote.syncTitle")}</h1>
        <p className={styles.text}>{t("onboarding.pronote.syncText")}</p>
        <Spinner size="large" label={t("onboarding.pronote.syncTitle")} />
        <Card rows className={pronote.progress}>
          {steps.map((step, index) => (
            <SettingRow
              key={step}
              className={index > phase.done ? pronote.todo : undefined}
              media={
                index < phase.done ? (
                  <span className={pronote.doneIcon} aria-hidden="true">
                    <Check size={12} />
                  </span>
                ) : index === phase.done ? (
                  <Spinner />
                ) : (
                  <span className={pronote.todoIcon} aria-hidden="true" />
                )
              }
              title={t(`onboarding.pronote.steps.${step}`)}
            >
              {index < phase.done && (
                <span className={pronote.doneText}>
                  {t("onboarding.pronote.done")}
                </span>
              )}
            </SettingRow>
          ))}
        </Card>
      </div>
    );
  }

  if (phase.id === "pin") {
    return (
      <>
        <BackButton onClick={onBack} />
        <form
          className={styles.step}
          onSubmit={event => {
            event.preventDefault();
            void confirmPin(phase.finish);
          }}
        >
          <p className={styles.eyebrow}>{t("onboarding.pronote.pinEyebrow")}</p>
          <h1 className={styles.title}>{t("onboarding.pronote.pinTitle")}</h1>
          <p className={styles.text}>{t("onboarding.pronote.pinText")}</p>
          <TextField
            size="large"
            label={t("onboarding.pronote.pinLabel")}
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            value={pin}
            onChange={event => setPin(event.target.value.replace(/\D/g, ""))}
            // L'étape ne sert qu'à ça.
            autoFocus
          />
          {message}
          <footer className={styles.footer}>
            <Button
              type="submit"
              variant="primary"
              size="large"
              disabled={pin.length < 4}
            >
              {t("onboarding.pronote.confirm")}
            </Button>
          </footer>
        </form>
      </>
    );
  }

  return (
    <>
      <BackButton onClick={onBack} />
      <div className={styles.step}>
        <p className={styles.eyebrow}>{t("onboarding.pronote.loginEyebrow")}</p>
        <h1 className={styles.title}>
          {t("onboarding.pronote.loginTitle", { name: school.name })}
        </h1>
        <p className={styles.text}>{t("onboarding.pronote.loginText")}</p>

        {phase.id === "waiting" ? (
          <Card className={pronote.waiting} role="status">
            <Spinner />
            <span className={pronote.waitingText}>
              {t("onboarding.pronote.waiting")}
            </span>
            <Button
              onClick={() =>
                // Déjà ouverte : la commande la ramène au premier plan.
                void openEntLogin(
                  school.url,
                  deviceUUID,
                  t("onboarding.pronote.windowTitle")
                ).catch(() => undefined)
              }
            >
              {t("onboarding.pronote.show")}
            </Button>
          </Card>
        ) : (
          <InfoCard title={t("onboarding.pronote.safeTitle")}>
            <p>{t("onboarding.pronote.safeText")}</p>
          </InfoCard>
        )}
        {message}

        <footer className={styles.footer}>
          <Button
            variant="primary"
            size="large"
            disabled={phase.id === "waiting"}
            onClick={() => void open()}
          >
            {t(error ? "onboarding.pronote.retry" : "onboarding.pronote.open")}
          </Button>
        </footer>
      </div>
    </>
  );
}
