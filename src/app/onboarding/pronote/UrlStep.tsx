// L'adresse de l'établissement (maquette 07-url-pronote) : collée telle quelle, nettoyée, puis
// vérifiée auprès de PRONOTE, qui donne le nom de l'établissement et son ENT.
import { Check } from "@getpapillon/papicons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button/Button";
import { Card } from "@/components/Card/Card";
import { InfoCard } from "@/components/InfoCard/InfoCard";
import { Spinner } from "@/components/Spinner/Spinner";
import { TextField } from "@/components/TextField/TextField";
import { useLookup } from "@/hooks/useLookup";
import { findInstance, type InstanceInfo } from "@/services/pronote/login";

import styles from "../onboarding.module.scss";
import { errorKey, logFailure } from "./errors";
import pronote from "./pronote.module.scss";

/** Le détail d'un échec va au journal ; l'écran explique le cas le plus courant. */
const searchInstance = (input: string) =>
  findInstance(input).catch((error: unknown) => {
    logFailure("adresse", error);
    throw error;
  });

const HOW_TO = ["urlStep1", "urlStep2", "urlStep3"] as const;

export function UrlStep({
  onNext,
}: {
  onNext: (instance: InstanceInfo) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const lookup = useLookup(value.trim(), searchInstance);
  const found = lookup.status === "ready" ? lookup.data : null;

  return (
    <div className={styles.step}>
      <p className={styles.eyebrow}>{t("onboarding.pronote.urlEyebrow")}</p>
      <h1 className={styles.title}>{t("onboarding.pronote.urlTitle")}</h1>

      <div className={pronote.stack}>
        <TextField
          size="large"
          label={t("onboarding.pronote.urlLabel")}
          type="url"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          placeholder="https://0000000a.index-education.net/pronote/"
          value={value}
          onChange={event => setValue(event.target.value)}
        />

        <InfoCard title={t("onboarding.pronote.urlHelp")}>
          <ol className={pronote.howTo}>
            {HOW_TO.map(key => (
              <li key={key}>{t(`onboarding.pronote.${key}`)}</li>
            ))}
          </ol>
        </InfoCard>

        {lookup.status === "loading" && (
          <p className={pronote.status}>
            <Spinner />
            {t("onboarding.pronote.checking")}
          </p>
        )}
        {lookup.status === "error" && (
          <p className={styles.error} role="alert">
            {typeof lookup.error === "string"
              ? t(errorKey(lookup.error))
              : t("onboarding.pronote.instanceFailed")}
          </p>
        )}
        {found && (
          <Card tone="success" className={pronote.found} role="status">
            <Check size={18} aria-hidden="true" />
            <span>
              <strong>{found.name}</strong>
              <small>
                {[
                  found.version && `PRONOTE ${found.version}`,
                  found.ent
                    ? t("onboarding.pronote.instanceEnt", { ent: found.ent })
                    : t("onboarding.pronote.instanceDirect"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            </span>
          </Card>
        )}
      </div>

      <footer className={styles.footer}>
        <Button
          variant="primary"
          size="large"
          disabled={!found}
          onClick={() => found && onNext(found)}
        >
          {t("onboarding.continue")}
        </Button>
      </footer>
    </div>
  );
}
