// Images choisies par l'utilisateur (photo de profil, fond d'écran) : redimensionnées dans un
// canvas puis gardées en URL `data:` JPEG, assez légère pour la base ou le stockage local.
// La CSP autorise `data:` pour les images seulement (tauri.conf.json).

import { luminance } from "./color";

/** Au-delà, le fichier n'est même pas décodé. */
const MAX_FILE_SIZE = 25 * 1024 * 1024;

export class ImageError extends Error {
  constructor(readonly reason: "too_big" | "unreadable") {
    super(reason);
    this.name = "ImageError";
  }
}

/**
 * Ramène l'image à `size` pixels sur son plus grand côté (sans l'agrandir), ou la recadre en
 * carré de `size` au centre si `square`.
 */
export async function resizeImage(
  file: Blob,
  size: number,
  { square = false, quality = 0.85 } = {}
): Promise<string> {
  if (file.size > MAX_FILE_SIZE) {
    throw new ImageError("too_big");
  }
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new ImageError("unreadable");
  });
  const { width, height } = bitmap;
  const scale = square
    ? size / Math.min(width, height)
    : Math.min(1, size / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = square ? size : Math.round(width * scale);
  canvas.height = square ? size : Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new ImageError("unreadable");
  }
  context.drawImage(
    bitmap,
    (canvas.width - width * scale) / 2,
    (canvas.height - height * scale) / 2,
    width * scale,
    height * scale
  );
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

/** Les formats proposés dans le sélecteur de fichiers. */
export const IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/gif";

/** Une partie d'image, en fractions de sa largeur et de sa hauteur (entre 0 et 1). */
export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Découpe `crop` dans l'image `source` (URL `data:`, la CSP n'en accepte pas d'autre) et la
 * rend en JPEG d'au plus `maxWidth` pixels de large, sans l'agrandir.
 */
export async function cropImage(
  source: string,
  crop: Crop,
  maxWidth: number,
  quality = 0.8
): Promise<string> {
  const image = new Image();
  image.src = source;
  await image.decode().catch(() => {
    throw new ImageError("unreadable");
  });
  const sourceWidth = crop.width * image.naturalWidth;
  const sourceHeight = crop.height * image.naturalHeight;
  const scale = Math.min(1, maxWidth / sourceWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sourceWidth * scale);
  canvas.height = Math.round(sourceHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new ImageError("unreadable");
  }
  context.drawImage(
    image,
    crop.x * image.naturalWidth,
    crop.y * image.naturalHeight,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );
  return canvas.toDataURL("image/jpeg", quality);
}

/** La luminosité retenue : le 8e décile, pour qu'une zone claire compte même petite. */
const BRIGHT_PART = 0.8;

/**
 * Luminosité du haut de l'image (`source`, URL `data:`), là où s'affichent le bonjour, le
 * résumé et les boutons de l'accueil : entre 0 et 1.
 */
export async function topBrightness(source: string): Promise<number> {
  const image = new Image();
  image.src = source;
  await image.decode().catch(() => {
    throw new ImageError("unreadable");
  });
  // Les 60 % du haut de l'image, réduits à 48 × 12 points.
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 12;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new ImageError("unreadable");
  }
  context.drawImage(
    image,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight * 0.6,
    0,
    0,
    canvas.width,
    canvas.height
  );
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const values: number[] = [];
  for (let index = 0; index < data.length; index += 4) {
    values.push(
      luminance([data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0])
    );
  }
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length * BRIGHT_PART)] ?? 0;
}
