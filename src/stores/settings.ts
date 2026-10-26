// Réglages de l'interface, enregistrés dans le stockage de la WebView. Aucun secret ici.
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "system" | "light" | "dark";
export type Language = "fr" | "en";

interface SettingsState {
  theme: Theme;
  language: Language;
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      theme: "system",
      language: navigator.language.startsWith("en") ? "en" : "fr",
      setTheme: theme => set({ theme }),
      setLanguage: language => set({ language }),
    }),
    { name: "pieride-settings" }
  )
);
