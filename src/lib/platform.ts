// Le système de la machine, pour les boutons de la fenêtre et les raccourcis affichés.
export const isMac = navigator.userAgent.includes("Mac");

/** Touche des raccourcis telle qu'on l'affiche : `⌘` sous macOS, `Ctrl` ailleurs. */
export const MOD = isMac ? "⌘" : "Ctrl";
