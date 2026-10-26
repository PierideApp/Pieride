// Personnalisation : le thème. Couleur d'accentuation et fond d'écran viendront avec l'accueil.
import { useTranslation } from "react-i18next";

import { type Theme, useSettingsStore } from "@/stores/settings";

import styles from "./settings.module.scss";

const THEMES: readonly Theme[] = ["light", "dark", "system"];

/** Mini-fenêtre aux couleurs d'un thème : `data-theme` force ses variables (theme.scss). */
const Preview = ({ theme }: { theme: "light" | "dark" }) => (
  <span className={styles.preview} data-theme={theme}>
    <span className={styles.previewSidebar} />
    <span className={styles.previewLines}>
      <span />
      <span />
      <span />
    </span>
  </span>
);

export function AppearanceSettings() {
  const { t } = useTranslation();
  const theme = useSettingsStore(state => state.theme);
  const setTheme = useSettingsStore(state => state.setTheme);

  return (
    <fieldset className={styles.block}>
      <legend className={styles.label}>{t("settings.theme.label")}</legend>
      <div className={styles.themes}>
        {THEMES.map(value => (
          <label
            key={value}
            className={styles.theme}
            data-checked={value === theme || undefined}
          >
            <span className={styles.previewFrame} aria-hidden="true">
              {value === "system" ? (
                <>
                  <Preview theme="light" />
                  <Preview theme="dark" />
                </>
              ) : (
                <Preview theme={value} />
              )}
            </span>
            <span className={styles.option}>
              <input
                type="radio"
                name="theme"
                checked={value === theme}
                onChange={() => setTheme(value)}
              />
              {t(`settings.theme.${value}`)}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
