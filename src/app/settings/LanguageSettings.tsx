import { useTranslation } from "react-i18next";

import { Card } from "@/components/Card/Card";
import { Chip } from "@/components/Chip/Chip";
import { SettingRow } from "@/components/SettingRow/SettingRow";
import { translationProgress } from "@/lib/i18n";
import { LANGUAGES, systemLanguage, useSettingsStore } from "@/stores/settings";

import styles from "./settings.module.scss";

/**
 * Langue : i18next suit le réglage en direct (lib/i18n.ts). Celle de l'ordinateur est
 * recommandée, les autres affichent l'avancée de leur traduction.
 */
export function LanguageSettings() {
  const { t, i18n } = useTranslation();
  const language = useSettingsStore(state => state.language);
  const setPreference = useSettingsStore(state => state.setPreference);
  const recommended = systemLanguage();
  const percent = new Intl.NumberFormat(i18n.language, { style: "percent" });

  return (
    <Card rows role="radiogroup" aria-label={t("settings.sections.language")}>
      {LANGUAGES.map(({ id, name }) => (
        <SettingRow key={id} as="label" title={<span lang={id}>{name}</span>}>
          {id === recommended ? (
            <Chip>{t("settings.language.recommended")}</Chip>
          ) : (
            <span className={styles.hint}>
              {percent.format(translationProgress(id))}
            </span>
          )}
          <input
            type="radio"
            name="language"
            checked={id === language}
            onChange={() => setPreference("language", id)}
          />
        </SettingRow>
      ))}
    </Card>
  );
}
