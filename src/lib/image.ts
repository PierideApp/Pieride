// Images choisies par l'utilisateur (photo de profil, fond d'écran) : redimensionnées dans un
// canvas puis gardées en URL `data:` JPEG, assez légère pour la base ou le stockage local.
// La CSP autorise `data:` pour les images seulement (tauri.conf.json).

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
