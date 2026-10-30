// Fond d'écran du bandeau de l'accueil (Paramètres > Personnalisation > Fond d'écran),
// enregistré dans le stockage de la WebView. À part des réglages : l'image choisie pèse
// quelques centaines de Ko, inutile de la réécrire à chaque changement de réglage.
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { luminance, shadeFor } from "@/lib/color";

/** Dégradés proposés (maquette 04-fond-ecran). */
export const GRADIENTS = [
  { id: "indigo", colors: ["#4a57e8", "#16127a"] },
  { id: "sunset", colors: ["#f1e25b", "#e8901c"] },
  { id: "lagoon", colors: ["#26b290", "#007fda"] },
  { id: "raspberry", colors: ["#dd0030", "#962dd8"] },
  { id: "mist", colors: ["#a9b4ff", "#f4f5fb"] },
] as const;
export type Gradient = (typeof GRADIENTS)[number]["id"];

/**
 * Proportion d'une image de fond : celle du bandeau de l'accueil (maquette 02-accueil :
 * 1184 × 300 px). Le recadrage la garde, l'image s'affiche donc sans surprise.
 */
export const WALLPAPER_RATIO = 4;

interface Wallpaper {
  /** Un dégradé, l'image choisie, ou rien : le bandeau garde le fond de la marque. */
  wallpaper: Gradient | "image" | null;
  /** L'image choisie, en URL `data:` (lib/image.ts). Gardée quand on passe à un dégradé. */
  image: string | null;
  /** Voile mesuré sur l'image au recadrage (lib/color.ts, `shadeFor`). */
  shade?: number;
}

interface WallpaperState extends Wallpaper {
  choose: (wallpaper: Gradient | "image" | null) => void;
  setImage: (image: string, shade: number) => void;
  clear: () => void;
}

export const useWallpaperStore = create<WallpaperState>()(
  persist(
    set => ({
      wallpaper: null,
      image: null,
      choose: wallpaper => set({ wallpaper }),
      setImage: (image, shade) => set({ wallpaper: "image", image, shade }),
      clear: () => set({ wallpaper: null, image: null, shade: undefined }),
    }),
    { name: "pieride-wallpaper" }
  )
);

/** Le fond CSS d'un fond d'écran, ou `undefined` pour garder celui de la marque. */
export function wallpaperBackground({
  wallpaper,
  image,
}: Wallpaper): string | undefined {
  if (wallpaper === "image") {
    return image ? `center / cover no-repeat url("${image}")` : undefined;
  }
  const gradient = GRADIENTS.find(({ id }) => id === wallpaper);
  return gradient && `linear-gradient(135deg, ${gradient.colors.join(", ")})`;
}

/** Image choisie avant la mesure du voile : un voile moyen, au cas où elle serait claire. */
const UNMEASURED_SHADE = 0.35;

/**
 * Le voile sombre à poser derrière le texte blanc du bandeau (entre 0 et 0,7) : mesuré pour une
 * image, calculé d'après la couleur la plus claire d'un dégradé, aucun pour la marque.
 */
export function wallpaperShade({
  wallpaper,
  shade,
}: Pick<Wallpaper, "wallpaper" | "shade">): number {
  if (wallpaper === "image") {
    return shade ?? UNMEASURED_SHADE;
  }
  const gradient = GRADIENTS.find(({ id }) => id === wallpaper);
  return gradient ? shadeFor(Math.max(...gradient.colors.map(luminance))) : 0;
}
