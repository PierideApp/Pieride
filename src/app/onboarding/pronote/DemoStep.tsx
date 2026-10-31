// L'adresse de l'établissement (maquette 07-url-pronote) : collée telle quelle, nettoyée, puis
// vérifiée auprès de PRONOTE, qui donne le nom de l'établissement et son ENT.
import { Check } from "@getpapillon/papicons";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button/Button";
import { Card } from "@/components/Card/Card";
import { InfoCard } from "@/components/InfoCard/InfoCard";
import { Spinner } from "@/components/Spinner/Spinner";
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

export function DemoStep({
  onNext,
}: {
  onNext: (instance: InstanceInfo) => void;
}) {
  const { t } = useTranslation();
  const value: string = "https://demo.index-education.net/pronote";
  const lookup = useLookup(value.trim(), searchInstance);
  const found = lookup.status === "ready" ? lookup.data : null;

  return (
    <div className={styles.step}>
      <p className={styles.eyebrow}>{t("onboarding.pronote.demoEyeBrow")}</p>
      <h1 className={styles.title}>{t("onboarding.pronote.demoTitle")}</h1>

      <div className={pronote.stack}>
        <InfoCard type="warn" title={t("onboarding.pronote.demoWarn")}>
          <p>{t("onboarding.pronote.demoWarnText")}</p>
          <p>{t("onboarding.pronote.demoWarnText2")}</p>
          <p>{t("onboarding.pronote.demoWarnText3")}</p>
        </InfoCard>
        <InfoCard type="info" title={t("onboarding.pronote.demoOrigin")}>
          <p>https://demo.index-education.net/pronote</p>
        </InfoCard>
        <p>{t("onboarding.pronote.demoContinue")}</p>
      </div>

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
