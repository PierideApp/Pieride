// Bienvenue : la marque en plein écran et un aperçu de l'app (cartes fictives, décoratives).
import {
  ArrowRight,
  ArrowRightUp,
  Check,
  Cutlery,
} from "@getpapillon/papicons";
import { useTranslation } from "react-i18next";

import { WindowControls } from "@/app/layout/WindowControls";
import icon from "@/assets/brand/icon.svg";

import styles from "./onboarding.module.scss";

export function Welcome({ onStart }: { onStart: () => void }) {
  const { t, i18n } = useTranslation();
  const number = (value: number, sign = false) =>
    new Intl.NumberFormat(i18n.language, {
      minimumFractionDigits: 2,
      signDisplay: sign ? "exceptZero" : "auto",
    }).format(value);

  return (
    <div className={styles.welcome} data-tauri-drag-region>
      <WindowControls tone="onBrand" />
      <div className={styles.welcomeText}>
        <img src={icon} alt="" width={88} height={88} />
        <h1>{t("onboarding.welcome.title")}</h1>
        <p>{t("onboarding.welcome.text")}</p>
        <button
          type="button"
          className={styles.start}
          // Le seul choix de l'écran : `Entrée` suffit pour commencer.
          autoFocus
          onClick={onStart}
        >
          <ArrowRight size={18} />
          {t("onboarding.welcome.start")}
        </button>
      </div>

      <div className={styles.preview} aria-hidden="true">
        <div className={styles.course} data-tone="accent">
          <strong>{t("onboarding.preview.math")}</strong>
          <span className={styles.now}>{t("onboarding.preview.now")}</span>
          <small>{t("onboarding.preview.mathRoom")}</small>
          <small>{t("onboarding.preview.hour")}</small>
        </div>
        <div className={styles.course} data-tone="error">
          <strong>{t("onboarding.preview.physics")}</strong>
          <small>{t("onboarding.preview.physicsRoom")}</small>
          <small>{t("onboarding.preview.hour")}</small>
        </div>
        <div className={styles.previewRow}>
          <div className={styles.previewCard}>
            <small>{t("onboarding.preview.average")}</small>
            <span className={styles.average}>{number(14.89)}</span>
            <span className={styles.trend}>
              <ArrowRightUp size={12} />
              {number(0.42, true)}
            </span>
          </div>
          <div className={styles.previewCard}>
            <span className={styles.homeworkHead}>
              <strong>{t("onboarding.preview.english")}</strong>
              <small>{t("onboarding.preview.tomorrow")}</small>
            </span>
            <span>{t("onboarding.preview.homework")}</span>
          </div>
        </div>
        <div className={styles.previewCard}>
          <span className={styles.homeworkHead}>
            <strong>
              <Cutlery size={16} className={styles.menuIcon} />
              {t("onboarding.preview.menu")}
            </strong>
            <span className={styles.booked}>
              <Check size={12} />
              {t("onboarding.preview.booked")}
            </span>
          </span>
          <strong>{t("onboarding.preview.dish")}</strong>
          <small>{t("onboarding.preview.dessert")}</small>
        </div>
      </div>
    </div>
  );
}
