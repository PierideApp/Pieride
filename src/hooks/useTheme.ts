import { useEffect } from "react";

import { ACCENTS, useSettingsStore } from "@/stores/settings";

/** Applique le thème choisi ; « système » suit le réglage de l'ordinateur en direct. */
export function useTheme() {
  const theme = useSettingsStore(state => state.theme);
  const accent = useSettingsStore(state => state.accent);
  useEffect(() => {
    const dark = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved =
        theme === "system" ? (dark.matches ? "dark" : "light") : theme;
      document.documentElement.dataset.theme = resolved;
    };
    apply();
    dark.addEventListener("change", apply);
    return () => dark.removeEventListener("change", apply);
  }, [theme]);

  // Une couleur autre que l'indigo : theme.scss en déduit les teintes (`[data-accent]`).
  useEffect(() => {
    const root = document.documentElement;
    const choice = ACCENTS.find(({ id }) => id === accent);
    if (!choice || choice.id === "indigo") {
      delete root.dataset.accent;
      root.style.removeProperty("--accent");
      root.style.removeProperty("--accent-on");
      return;
    }
    root.dataset.accent = choice.id;
    root.style.setProperty("--accent", choice.color);
    if ("onAccent" in choice) {
      root.style.setProperty("--accent-on", choice.onAccent);
    } else {
      root.style.removeProperty("--accent-on");
    }
  }, [accent]);
}
