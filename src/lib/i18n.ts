// Textes de l'interface : `fr.json` est la référence, `en.json` doit avoir les mêmes clés.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import { type Language, useSettingsStore } from "@/stores/settings";

const TEXTS: Record<Language, unknown> = { fr, en };

void i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, en: { translation: en } },
  lng: useSettingsStore.getState().language,
  fallbackLng: "fr",
  // React échappe déjà les textes.
  interpolation: { escapeValue: false },
});

useSettingsStore.subscribe(({ language }) => {
  if (language !== i18n.language) {
    void i18n.changeLanguage(language);
  }
});

/** Nombre de textes non vides d'un fichier de langue. */
function countTexts(value: unknown): number {
  if (typeof value === "string") {
    return value ? 1 : 0;
  }
  if (typeof value !== "object" || value === null) {
    return 0;
  }
  return Object.values(value).reduce<number>(
    (total, child: unknown) => total + countTexts(child),
    0
  );
}

/** Part des textes traduits dans une langue (de 0 à 1), le français étant la référence. */
export const translationProgress = (language: Language) =>
  Math.min(1, countTexts(TEXTS[language]) / countTexts(fr));

export default i18n;
