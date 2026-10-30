// Panneau détail à droite (UX §2 et §3) : une page l'ouvre au clic sur un élément
// (un cours, une note…) au lieu d'une fenêtre qui cacherait la liste.
import type { ReactNode } from "react";
import { create } from "zustand";

export interface DetailContent {
  title: string;
  subtitle?: string;
  /** À droite du titre : l'emoji d'une matière… */
  media?: ReactNode;
  body: ReactNode;
}

interface DetailState {
  content: DetailContent | null;
  open: (content: DetailContent) => void;
  close: () => void;
}

export const useDetailStore = create<DetailState>()(set => ({
  content: null,
  open: content => set({ content }),
  close: () => set({ content: null }),
}));
