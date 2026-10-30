// Disposition de l'accueil (« Modifier l'accueil ») : en haut, une rangée de cartes d'une ligne
// (taille `mini`, les raccourcis de la maquette) ; dessous, une grille de 12 colonnes et de
// lignes de 66 px pour les widgets plus grands. La taille normale reprend la maquette 02-accueil.
import {
  type HomeItem,
  type HomeWidget,
  WIDGET_SIZES,
  type WidgetSize,
} from "@/stores/settings";

/** Colonnes (sur 12) et lignes de chaque widget, aux tailles qu'il propose. */
export const SIZES: Record<
  HomeWidget,
  Partial<Record<WidgetSize, readonly [number, number]>>
> = {
  attendance: { mini: [4, 1], normal: [4, 3], large: [6, 5], full: [12, 5] },
  news: { mini: [4, 1], normal: [4, 3], large: [6, 5], full: [12, 5] },
  courses: {
    mini: [4, 1],
    compact: [3, 3],
    normal: [6, 8],
    large: [9, 8],
    full: [12, 8],
  },
  average: {
    mini: [4, 1],
    compact: [3, 3],
    normal: [6, 3],
    large: [6, 5],
    full: [12, 5],
  },
  tasks: {
    mini: [4, 1],
    compact: [3, 3],
    normal: [3, 5],
    large: [6, 5],
    full: [12, 5],
  },
  grades: {
    mini: [4, 1],
    compact: [3, 3],
    normal: [3, 5],
    large: [6, 5],
    full: [12, 5],
  },
};

/** Les tailles que propose un widget, de la plus petite à la plus grande. */
export const sizesOf = (id: HomeWidget): WidgetSize[] =>
  WIDGET_SIZES.filter(size => SIZES[id][size]);

/** Colonnes et lignes d'un widget à une taille (sa plus proche s'il ne la propose pas). */
export const spanOf = (id: HomeWidget, size: WidgetSize) =>
  SIZES[id][size] ?? SIZES[id].normal ?? ([4, 3] as const);

/** La carte d'une ligne vit dans la rangée du haut, les autres tailles dans la grille. */
export const isMini = (size: WidgetSize) => size === "mini";

/** Ce que montre un widget : `full` montre comme `large`, sur toute la largeur. */
export type WidgetLevel = "mini" | "compact" | "normal" | "large";
export const levelOf = (size: WidgetSize): WidgetLevel =>
  size === "full" ? "large" : size;

/** Le widget `id` déplacé à la place `index` ; la disposition est rendue telle quelle sans lui. */
export function moveTo(
  layout: readonly HomeItem[],
  id: HomeWidget,
  index: number
): HomeItem[] {
  const item = layout.find(other => other.id === id);
  if (!item) {
    return [...layout];
  }
  const rest = layout.filter(other => other.id !== id);
  rest.splice(Math.max(0, Math.min(index, rest.length)), 0, item);
  return rest;
}

/** Où poser un widget glissé : avant ou après un autre, ou à la fin d'une zone. */
export type Drop =
  | { kind: "before" | "after"; target: HomeWidget }
  | { kind: "end"; zone: "strip" | "grid" };

/** Le widget à la taille de sa zone : carte en haut, sa taille d'avant (ou normale) dans la grille. */
function fitZone(item: HomeItem, zone: "strip" | "grid"): HomeItem {
  if (zone === "strip") {
    return isMini(item.size)
      ? item
      : { id: item.id, size: "mini", previous: item.size };
  }
  return isMini(item.size)
    ? { id: item.id, size: item.previous ?? "normal" }
    : item;
}

/**
 * La disposition une fois `id` posé à `drop`. Posé en haut il devient une carte ; redescendu,
 * il retrouve sa taille d'avant.
 */
export function dropItem(
  layout: readonly HomeItem[],
  id: HomeWidget,
  drop: Drop
): HomeItem[] {
  const item = layout.find(other => other.id === id);
  const rest = layout.filter(other => other.id !== id);
  if (!item) {
    return [...layout];
  }
  if (drop.kind === "end") {
    const strip = drop.zone === "strip";
    let index = strip ? 0 : rest.length;
    rest.forEach((other, position) => {
      if (isMini(other.size) === strip) {
        index = position + 1;
      }
    });
    rest.splice(index, 0, fitZone(item, drop.zone));
    return rest;
  }
  const target = rest.find(other => other.id === drop.target);
  if (!target) {
    return [...layout];
  }
  const index = rest.indexOf(target) + (drop.kind === "after" ? 1 : 0);
  rest.splice(index, 0, fitZone(item, isMini(target.size) ? "strip" : "grid"));
  return rest;
}

/** La disposition avec `id` à la taille `size` ; passer en carte retient la taille d'avant. */
export function resizeItem(
  layout: readonly HomeItem[],
  id: HomeWidget,
  size: WidgetSize
): HomeItem[] {
  return layout.map(item =>
    item.id !== id || item.size === size
      ? item
      : isMini(size)
        ? { id, size, previous: item.size }
        : { id, size }
  );
}

/** La taille d'à côté que propose le widget, plus petite (`-1`) ou plus grande (`1`). */
export function stepSize(
  id: HomeWidget,
  size: WidgetSize,
  step: 1 | -1
): WidgetSize {
  const sizes = sizesOf(id);
  const index = sizes.indexOf(size) + step;
  return sizes[Math.max(0, Math.min(index, sizes.length - 1))] ?? size;
}
