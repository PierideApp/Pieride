// Service scolaire. Seul le compte hors ligne est disponible : les connexions arrivent avec
// leurs services (PRONOTE en M3, les autres en M4).
import {
  ChevronRight,
  Ecoledirecte,
  GraduationHat,
  type Home,
  Pronote,
  Skolengo,
  User,
} from "@getpapillon/papicons";
import { useTranslation } from "react-i18next";

import { SERVICE_NAMES } from "@/services/shared/plugin";

import styles from "./onboarding.module.scss";

function Option({
  icon: Icon,
  title,
  text,
  onClick,
}: {
  icon: typeof Home;
  title: string;
  text: string;
  /** Absent : bientôt disponible. */
  onClick?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={styles.option}
      disabled={!onClick}
      onClick={onClick}
    >
      <span className={styles.optionIcon} aria-hidden="true">
        <Icon size={20} />
      </span>
      <span className={styles.optionText}>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
      {onClick ? (
        <ChevronRight size={18} className={styles.chevron} />
      ) : (
        <span className={styles.soon}>{t("onboarding.service.soon")}</span>
      )}
    </button>
  );
}

export function ServiceStep({ onOffline }: { onOffline: () => void }) {
  const { t } = useTranslation();
  return (
    <div className={styles.step}>
      <p className={styles.eyebrow}>{t("onboarding.service.eyebrow")}</p>
      <h1 className={styles.title}>{t("onboarding.service.title")}</h1>
      <p className={styles.text}>{t("onboarding.service.text")}</p>

      <div className={styles.options}>
        <Option
          icon={Pronote}
          title={SERVICE_NAMES.pronote}
          text={t("onboarding.service.pronote")}
        />
        <Option
          icon={Ecoledirecte}
          title={SERVICE_NAMES.ecoledirecte}
          text={t("onboarding.service.ecoledirecte")}
        />
        <Option
          icon={Skolengo}
          title={SERVICE_NAMES.skolengo}
          text={t("onboarding.service.skolengo")}
        />
      </div>

      <p className={styles.label}>{t("onboarding.service.others")}</p>
      <div className={styles.optionsRow}>
        <Option
          icon={GraduationHat}
          title={t("onboarding.service.university")}
          text={t("onboarding.service.universityText")}
        />
        <Option
          icon={User}
          title={t("onboarding.service.offline")}
          text={t("onboarding.service.offlineText")}
          onClick={onOffline}
        />
      </div>
    </div>
  );
}
