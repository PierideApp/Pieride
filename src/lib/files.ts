// Pièces jointes des services (commandes Rust de `attachments.rs`). En cas d'échec, la promesse
// est rejetée avec un code : `type_refused` (programme, script…), `too_large`, `write_failed`,
// `open_failed`, `not_found` (pas téléchargée)…
import { invoke } from "@tauri-apps/api/core";

/** Le contenu part tel quel, sans JSON : un PDF de quelques Mo reste léger. */
export const openFile = (serviceId: string, name: string, bytes: Uint8Array) =>
  invoke<void>("attachment_open", bytes, {
    headers: { service: serviceId, name: encodeURIComponent(name) },
  });

/** L'empreinte SHA-256 de la clé : un nom de sous-dossier sûr. */
export async function folderOf(key: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key)
  );
  return Array.from(new Uint8Array(digest), byte =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

export const saveFile = (
  serviceId: string,
  folder: string,
  name: string,
  bytes: Uint8Array
) =>
  invoke<void>("attachment_save", bytes, {
    headers: { service: serviceId, folder, name: encodeURIComponent(name) },
  });

export const openSavedFile = (
  serviceId: string,
  folder: string,
  reveal = false
) =>
  invoke<void>("attachment_saved_open", { service: serviceId, folder, reveal });

/** Par sous-dossier : `false` si le fichier a été déplacé ou effacé à la main. */
export const savedFolders = (serviceId: string) =>
  invoke<Record<string, boolean>>("attachments_saved", { service: serviceId });

/** Efface les fichiers d'un service délié ou d'un compte retiré. */
export const forgetFiles = (serviceId: string) =>
  invoke<void>("attachments_forget", { service: serviceId });
