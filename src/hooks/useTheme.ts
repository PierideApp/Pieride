import { useEffect } from "react";

import { accentShades } from "@/lib/color";
import { type Accent, ACCENTS, useSettingsStore } from "@/stores/settings";

const ACCENT_VARIABLES = [
  "--color-accent",
  "--color-accent-text",
  "--color-accent-soft",
  "--color-on-accent",
];

/**
 * Pose les teintes d'une couleur autre que l'indigo, calculées pour le thème affiché (lib/color.ts) ;
 * l'indigo garde celles de theme.scss.
 */
function applyAccent(root: HTMLElement, id: Accent, dark: boolean) {
  for (const name of ACCENT_VARIABLES) {
    root.style.removeProperty(name);
  }
  const choice = ACCENTS.find(accent => accent.id === id);
  if (!choice || choice.id === "indigo") {
    return;
  }
  // Le fond des cartes du thème, lu dans theme.scss : la teinte douce se pose dessus.
  const surface = getComputedStyle(root)
    .getPropertyValue("--color-surface")
    .trim();
  const shades = accentShades(choice.color, dark, surface);
  root.style.setProperty("--color-accent", shades.accent);
  root.style.setProperty("--color-accent-text", shades.text);
  root.style.setProperty("--color-accent-soft", shades.soft);
  root.style.setProperty(
    "--color-on-accent",
    "onAccent" in choice ? choice.onAccent : "#ffffff"
  );
}

/** Applique le thème et la couleur choisis ; « système » suit le réglage de l'ordinateur en direct. */
export function useTheme() {
  const theme = useSettingsStore(state => state.theme);
  const accent = useSettingsStore(state => state.accent);
  useEffect(() => {
    const root = document.documentElement;
    const dark = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved =
        theme === "system" ? (dark.matches ? "dark" : "light") : theme;
      root.dataset.theme = resolved;
      applyAccent(root, accent, resolved === "dark");
    };
    apply();
    dark.addEventListener("change", apply);
    return () => dark.removeEventListener("change", apply);
  }, [theme, accent]);
}
