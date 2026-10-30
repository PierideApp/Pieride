// Mélange de couleurs calculé ici plutôt qu'avec `color-mix()` en CSS : le WebKit de certains
// Mac ne résout pas `color-mix()` quand il contient une variable, et la couleur disparaît
// (bouton principal, pastilles des matières en sombre). Même résultat que
// `color-mix(in oklab, couleur poids, autre)`, d'après l'espace Oklab de Björn Ottosson.

type Rgb = [number, number, number];

const toLinear = (channel: number) => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

const fromLinear = (value: number) => {
  const channel =
    value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, channel)) * 255);
};

function parseHex(color: string): Rgb | null {
  const match = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!match) {
    return null;
  }
  const value = parseInt(match[1], 16);
  return [value >> 16, (value >> 8) & 0xff, value & 0xff];
}

function toOklab([r, g, b]: Rgb): Rgb {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  );
  const m = Math.cbrt(
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  );
  const s = Math.cbrt(
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb
  );
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([lightness, a, b]: Rgb): string {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const channels = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return `#${channels
    .map(value => fromLinear(value).toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * `weight` de `color` (entre 0 et 1) mélangé au reste d'`other`, en Oklab. Les deux sont en
 * `#rrggbb` ; sinon `color` est rendue telle quelle.
 */
export function mix(color: string, other: string, weight: number): string {
  const first = parseHex(color);
  const second = parseHex(other);
  if (!first || !second) {
    return color;
  }
  const [a, b] = [toOklab(first), toOklab(second)];
  return fromOklab([
    a[0] * weight + b[0] * (1 - weight),
    a[1] * weight + b[1] * (1 - weight),
    a[2] * weight + b[2] * (1 - weight),
  ]);
}

/**
 * Les teintes d'une couleur d'accentuation (Paramètres > Personnalisation), posées sur
 * `surface`, le fond des cartes du thème. Plus claires en sombre pour rester lisibles.
 */
export function accentShades(color: string, dark: boolean, surface: string) {
  const text = dark ? mix(color, "#ffffff", 0.5) : color;
  return {
    accent: dark ? mix(color, "#ffffff", 0.75) : color,
    text,
    soft: mix(text, surface, dark ? 0.22 : 0.12),
  };
}

/** Luminance relative (WCAG) d'une couleur `#rrggbb` ou de ses canaux, entre 0 et 1. */
export function luminance(color: string | Rgb): number {
  const rgb = typeof color === "string" ? parseHex(color) : color;
  if (!rgb) {
    return 0;
  }
  const [r, g, b] = rgb;
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Le voile sombre (opacité entre 0 et 0,7) à poser sur un fond de luminance `background` pour
 * que le texte blanc s'y lise : sous lui, la luminance doit tomber à 0,18 au plus (contraste
 * d'au moins 4,5:1 avec le blanc). Un fond déjà sombre n'est pas voilé.
 */
export function shadeFor(background: number): number {
  if (background <= SHADE_TARGET) {
    return 0;
  }
  return Math.min(MAX_SHADE, 1 - SHADE_TARGET / background);
}

const SHADE_TARGET = 0.18;
const MAX_SHADE = 0.7;
