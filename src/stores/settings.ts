// Réglages de l'interface, enregistrés dans le stockage de la WebView. Aucun secret ici.
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "system" | "light" | "dark";
export type Language = "fr" | "en";

/** Les langues de l'interface, chacune écrite dans sa propre langue. */
export const LANGUAGES: readonly { id: Language; name: string }[] = [
  { id: "fr", name: "Français" },
  { id: "en", name: "English" },
];

interface SettingsState {
  theme: Theme;
  language: Language;
  /** Modules masqués de la barre latérale, par compte (`disabledTabsByAccount` de Papillon). */
  hiddenModules: Record<string, string[]>;
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
  setModuleHidden: (
    accountId: string,
    moduleId: string,
    hidden: boolean
  ) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      theme: "system",
      language: navigator.language.startsWith("en") ? "en" : "fr",
      hiddenModules: {},
      setTheme: theme => set({ theme }),
      setLanguage: language => set({ language }),
      setModuleHidden: (accountId, moduleId, hidden) =>
        set(state => {
          const others = (state.hiddenModules[accountId] ?? []).filter(
            id => id !== moduleId
          );
          return {
            hiddenModules: {
              ...state.hiddenModules,
              [accountId]: hidden ? [...others, moduleId] : others,
            },
          };
        }),
    }),
    { name: "pieride-settings" }
  )
);
