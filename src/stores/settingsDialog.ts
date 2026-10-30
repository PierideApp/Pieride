// Fenêtre des Paramètres : ouverte sur la page en cours (changer de page la ferme), et
// éventuellement sur une section demandée par une page (bouton « Fond d'écran » de l'accueil).
import { create } from "zustand";

interface SettingsDialogState {
  /** Page sur laquelle les Paramètres sont ouverts. */
  openAt: string | null;
  /** Section demandée par une page (`appearance`…), et la page du fond d'écran. */
  section: string | null;
  wallpaper: boolean;
  /** Change à chaque demande de section : les Paramètres repartent de celle-ci. */
  request: number;
  show: (at: string, target?: { section: string; wallpaper?: boolean }) => void;
  close: () => void;
}

export const useSettingsDialog = create<SettingsDialogState>()(set => ({
  openAt: null,
  section: null,
  wallpaper: false,
  request: 0,
  show: (at, target) =>
    set(state =>
      target
        ? {
            openAt: at,
            section: target.section,
            wallpaper: target.wallpaper ?? false,
            request: state.request + 1,
          }
        : { openAt: at }
    ),
  // La demande d'une page ne vaut qu'une fois : rouverts, les Paramètres reprennent où ils étaient.
  close: () => set({ openAt: null, wallpaper: false }),
}));
