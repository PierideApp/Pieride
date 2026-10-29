// Service scolaire. PRONOTE et le compte hors ligne sont disponibles ; les autres services
// arrivent en M4.
import {
  Ecoledirecte,
  GraduationHat,
  Pronote,
  Skolengo,
  User,
} from "@getpapillon/papicons";
import { useTranslation } from "react-i18next";

import { ChoiceCard } from "@/components/ChoiceCard/ChoiceCard";
import { SERVICE_NAMES } from "@/services/shared/plugin";

import styles from "./onboarding.module.scss";

export function ServiceStep({
  onPronote,
  onOffline,
}: {
  onPronote: () => void;
  onOffline: () => void;
}) {
  const { t } = useTranslation();
  const soon = t("onboarding.service.soon");
  return (
    <div className={styles.step}>
      <p className={styles.eyebrow}>{t("onboarding.service.eyebrow")}</p>
      <h1 className={styles.title}>{t("onboarding.service.title")}</h1>
      <p className={styles.text}>{t("onboarding.service.text")}</p>

      <div className={styles.options}>
        <ChoiceCard
          icon={Pronote}
          title={SERVICE_NAMES.pronote}
          text={t("onboarding.service.pronote")}
          onClick={onPronote}
        />
        <ChoiceCard
          icon={Ecoledirecte}
          title={SERVICE_NAMES.ecoledirecte}
          text={t("onboarding.service.ecoledirecte")}
          disabledLabel={soon}
        />
        <ChoiceCard
          icon={Skolengo}
          title={SERVICE_NAMES.skolengo}
          text={t("onboarding.service.skolengo")}
          disabledLabel={soon}
        />
      </div>

      <p className={styles.label}>{t("onboarding.service.others")}</p>
      <div className={styles.optionsRow}>
        <ChoiceCard
          icon={GraduationHat}
          title={t("onboarding.service.university")}
          text={t("onboarding.service.universityText")}
          disabledLabel={soon}
        />
        <ChoiceCard
          icon={User}
          title={t("onboarding.service.offline")}
          text={t("onboarding.service.offlineText")}
          onClick={onOffline}
        />
      </div>
    </div>
  );
}
