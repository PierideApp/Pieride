// Qui es-tu ? Les comptes parents et professeurs ne sont pas pris en charge : on propose
// alors le compte hors ligne (maquette 03-non-disponible).
import { AlertTriangle } from "@getpapillon/papicons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import styles from "./onboarding.module.scss";

const PROFILES: readonly { id: string; emoji: string; supported: boolean }[] = [
  { id: "middle", emoji: "🎒", supported: true },
  { id: "high", emoji: "📚", supported: true },
  { id: "student", emoji: "🎓", supported: true },
  { id: "parent", emoji: "👪", supported: false },
  { id: "teacher", emoji: "🧑‍🏫", supported: false },
];

export function ProfileStep({
  onNext,
  onOffline,
}: {
  onNext: () => void;
  onOffline: () => void;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<(typeof PROFILES)[number]>();

  return (
    <div className={styles.step}>
      <p className={styles.eyebrow}>{t("onboarding.profile.eyebrow")}</p>
      <h1 className={styles.title}>{t("onboarding.profile.title")}</h1>
      <p className={styles.text}>{t("onboarding.profile.text")}</p>

      <fieldset className={styles.profiles}>
        <legend className={styles.visuallyHidden}>
          {t("onboarding.profile.title")}
        </legend>
        {PROFILES.map(profile => (
          <label
            key={profile.id}
            className={styles.profile}
            data-checked={profile === selected || undefined}
          >
            <input
              type="radio"
              name="profile"
              className={styles.visuallyHidden}
              checked={profile === selected}
              onChange={() => setSelected(profile)}
            />
            <span className={styles.emoji} aria-hidden="true">
              {profile.emoji}
            </span>
            {t(`onboarding.profile.${profile.id}`)}
          </label>
        ))}
      </fieldset>

      {selected?.supported === false && (
        <div className={styles.warning} role="status">
          <AlertTriangle size={20} className={styles.warningIcon} />
          <div>
            <strong>{t("onboarding.profile.unavailableTitle")}</strong>
            <p>{t("onboarding.profile.unavailableText")}</p>
          </div>
        </div>
      )}

      <footer className={styles.footer}>
        {selected?.supported === false ? (
          <>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setSelected(undefined)}
            >
              {t("onboarding.profile.other")}
            </button>
            <button
              type="button"
              className={styles.primary}
              onClick={onOffline}
            >
              {t("onboarding.profile.offline")}
            </button>
          </>
        ) : (
          <button
            type="button"
            className={styles.primary}
            disabled={!selected}
            onClick={onNext}
          >
            {t("onboarding.continue")}
          </button>
        )}
      </footer>
    </div>
  );
}
