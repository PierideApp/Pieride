import { useTranslation } from "react-i18next";

import { LANGUAGES, useSettingsStore } from "@/stores/settings";

import styles from "./settings.module.scss";

/** Langue : i18next suit le réglage en direct (lib/i18n.ts). */
export function LanguageSettings() {
  const { t } = useTranslation();
  const language = useSettingsStore(state => state.language);
  const setLanguage = useSettingsStore(state => state.setLanguage);

  return (
    <fieldset className={`${styles.block} ${styles.card}`}>
      <legend className={styles.visuallyHidden}>
        {t("settings.sections.language")}
      </legend>
      {LANGUAGES.map(({ id, name }) => (
        <label key={id} className={styles.row}>
          <span className={styles.rowText} lang={id}>
            <strong>{name}</strong>
          </span>
          <input
            type="radio"
            name="language"
            checked={id === language}
            onChange={() => setLanguage(id)}
          />
        </label>
      ))}
    </fieldset>
  );
}
