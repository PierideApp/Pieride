// Pièces jointes des services (commandes Rust de `attachments.rs`). En cas d'échec, la promesse
// est rejetée avec un code : `type_refused` (programme, script…), `too_large`, `write_failed`,
// `open_failed`, `not_found` (plus là)… Les chemins sont relatifs au dossier des
// téléchargements, séparés par des `/`.
import { invoke } from "@tauri-apps/api/core";

/** Le contenu part tel quel, sans JSON : un PDF de quelques Mo reste léger. */
export const openFile = (serviceId: string, name: string, bytes: Uint8Array) =>
  invoke<void>("attachment_open", bytes, {
    headers: { service: serviceId, name: encodeURIComponent(name) },
  });

/** Un fichier téléchargé, pour l'afficher sous son nom. */
export interface SavedFile {
  /** Les dossiers où il est rangé, sous celui du compte. */
  folders: string[];
  /** Son chemin complet ; absent s'il a été déplacé ou effacé à la main. */
  location?: string;
}

/**
 * Rangé dans `folders`, daté de `date`. Un fichier identique déjà là est repris ; un autre du
 * même nom n'est jamais écrasé. Renvoie son chemin.
 */
export const saveFile = (
  folders: string[],
  name: string,
  bytes: Uint8Array,
  date: Date
) =>
  invoke<string>("attachment_save", bytes, {
    headers: {
      folders: folders.map(encodeURIComponent).join("/"),
      name: encodeURIComponent(name),
      date: String(date.getTime()),
    },
  });

export const openSavedFile = (path: string, reveal = false) =>
  invoke<void>("attachment_saved_open", { path, reveal });

/** Dans l'ordre de `paths` : chemin complet et taille, `null` si déplacé ou effacé à la main. */
export const filesInfo = (paths: string[]) =>
  invoke<([string, number] | null)[]>("attachments_info", { paths });

/** Rejeté (`delete_failed`) si un fichier n'a pas pu partir, ouvert dans une autre app. */
export const deleteFiles = (paths: string[]) =>
  invoke<void>("attachments_delete", { paths });

/** Les fichiers ouverts d'un service délié ou d'un compte retiré, et ses téléchargements. */
export const forgetFiles = (serviceId: string, paths: string[]) =>
  invoke<void>("attachments_forget", { service: serviceId, paths });

export const downloadsFolder = () => invoke<string>("downloads_folder");

export const openDownloadsFolder = () => invoke<void>("downloads_folder_open");

/**
 * Le sélecteur du système. Les fichiers déjà téléchargés suivent : leurs nouveaux chemins,
 * dans l'ordre de `paths`, ou `null` si l'élève a annulé.
 */
export const chooseDownloadsFolder = (title: string, paths: string[]) =>
  invoke<string[] | null>("downloads_folder_choose", { title, paths });
