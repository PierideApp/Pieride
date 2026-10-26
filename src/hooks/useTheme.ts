import { useEffect } from "react";

import { useSettingsStore } from "@/stores/settings";

/** Applique le thème choisi ; « système » suit le réglage de l'ordinateur en direct. */
export function useTheme() {
  const theme = useSettingsStore(state => state.theme);
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
}
