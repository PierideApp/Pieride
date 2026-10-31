// Comment te connecter à PRONOTE ? (maquette 05-methode-connexion) : chercher l'établissement
// par ville, ou coller son adresse. Pas de QR-Code ni de position (UX §9).
import { GraduationHat, Link, Search } from "@getpapillon/papicons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button/Button";
import { ChoiceCard } from "@/components/ChoiceCard/ChoiceCard";
import { InfoCard } from "@/components/InfoCard/InfoCard";

import styles from "../onboarding.module.scss";
import pronote from "./pronote.module.scss";

export function MethodStep({
  onNext,
}: {
  onNext: (method: "city" | "url" | "demo") => void;
}) {
  const { t } = useTranslation();
  const [method, setMethod] = useState<"city" | "url" | "demo">("city");

  return (
    <div className={styles.step}>
      <p className={styles.eyebrow}>{t("onboarding.pronote.eyebrow")}</p>
      <h1 className={styles.title}>{t("onboarding.pronote.methodTitle")}</h1>
      <p className={styles.text}>{t("onboarding.pronote.methodText")}</p>

      <div className={pronote.stack}>
        <div
          className={styles.options}
          role="radiogroup"
          aria-label={t("onboarding.pronote.methodTitle")}
        >
          <ChoiceCard
            icon={Search}
            title={t("onboarding.pronote.city")}
            text={t("onboarding.pronote.cityText")}
            badge={t("onboarding.pronote.recommended")}
            selected={method === "city"}
            onClick={() => setMethod("city")}
          />
          <ChoiceCard
            icon={Link}
            title={t("onboarding.pronote.url")}
            text={t("onboarding.pronote.urlText")}
            selected={method === "url"}
            onClick={() => setMethod("url")}
          />
          <ChoiceCard
            icon={GraduationHat}
            title={t("onboarding.pronote.demo")}
            text={t("onboarding.pronote.demoText")}
            selected={method === "demo"}
            onClick={() => setMethod("demo")}
          />
        </div>
        <InfoCard title={t("onboarding.pronote.entTitle")}>
          <p>{t("onboarding.pronote.entText")}</p>
        </InfoCard>
      </div>

      <footer className={styles.footer}>
        <Button variant="primary" size="large" onClick={() => onNext(method)}>
          {t("onboarding.continue")}
        </Button>
      </footer>
    </div>
  );
}
