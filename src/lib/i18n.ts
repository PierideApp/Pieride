// Textes de l'interface : `fr.json` est la référence, `en.json` doit avoir les mêmes clés.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import { useSettingsStore } from "@/stores/settings";

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

export default i18n;
