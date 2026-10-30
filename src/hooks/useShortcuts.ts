// Raccourcis clavier du cadre (UX §5). On lit la touche physique (`code`) : sur un clavier
// AZERTY, la touche « 1 » donne `&` sans Majuscule. Sauf pour la virgule, qui change de place
// d'un clavier à l'autre : là, on lit le caractère (`key`).
import { useEffect } from "react";
import { useNavigate } from "react-router";

import { type ModuleManifest, modulePath } from "@/modules/registry";

type Keys = Pick<
  KeyboardEvent,
  "code" | "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"
>;

/** `Ctrl` sous Windows et Linux, `⌘` sous macOS, sans autre modificateur. */
const command = (event: Keys) =>
  (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;

/** `Ctrl/⌘ 1` à `9` : le module visible à cette place. */
export function shortcutModule(
  event: Keys,
  modules: readonly ModuleManifest[]
): ModuleManifest | undefined {
  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(event.code)?.[1];
  return digit && command(event) ? modules[Number(digit) - 1] : undefined;
}

/** `Ctrl/⌘ R` : synchroniser (et non recharger la page). */
export const isSyncShortcut = (event: Keys) =>
  event.code === "KeyR" && command(event);

/** `Ctrl/⌘ K` : palette de commandes. */
export const isPaletteShortcut = (event: Keys) =>
  event.code === "KeyK" && command(event);

/** `Ctrl/⌘ ,` : Paramètres. */
export const isSettingsShortcut = (event: Keys) =>
  event.key === "," && command(event);

export function useShortcuts(
  modules: readonly ModuleManifest[],
  {
    sync,
    palette,
    settings,
  }: { sync: () => void; palette: () => void; settings: () => void }
) {
  const navigate = useNavigate();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const module = shortcutModule(event, modules);
      if (module) {
        event.preventDefault();
        void navigate(modulePath(module));
      } else if (isSyncShortcut(event)) {
        event.preventDefault();
        sync();
      } else if (isPaletteShortcut(event)) {
        event.preventDefault();
        palette();
      } else if (isSettingsShortcut(event)) {
        event.preventDefault();
        settings();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modules, navigate, sync, palette, settings]);
}
