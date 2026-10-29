// Fond d'écran du bandeau de l'accueil (Paramètres > Personnalisation > Fond d'écran),
// enregistré dans le stockage de la WebView. À part des réglages : l'image choisie pèse
// quelques centaines de Ko, inutile de la réécrire à chaque changement de réglage.
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Dégradés proposés (maquette 04-fond-ecran). */
export const GRADIENTS = [
  { id: "indigo", colors: ["#4a57e8", "#16127a"] },
  { id: "sunset", colors: ["#f1e25b", "#e8901c"] },
  { id: "lagoon", colors: ["#26b290", "#007fda"] },
  { id: "raspberry", colors: ["#dd0030", "#962dd8"] },
  { id: "mist", colors: ["#a9b4ff", "#f4f5fb"] },
] as const;
export type Gradient = (typeof GRADIENTS)[number]["id"];

interface Wallpaper {
  /** Un dégradé, l'image choisie, ou rien : le bandeau garde le fond de la marque. */
  wallpaper: Gradient | "image" | null;
  /** L'image choisie, en URL `data:` (lib/image.ts). Gardée quand on passe à un dégradé. */
  image: string | null;
}

interface WallpaperState extends Wallpaper {
  choose: (wallpaper: Gradient | "image" | null) => void;
  setImage: (image: string) => void;
  clear: () => void;
}

export const useWallpaperStore = create<WallpaperState>()(
  persist(
    set => ({
      wallpaper: null,
      image: null,
      choose: wallpaper => set({ wallpaper }),
      setImage: image => set({ wallpaper: "image", image }),
      clear: () => set({ wallpaper: null, image: null }),
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
