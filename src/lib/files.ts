// Pièces jointes des services : écrites dans le cache de l'app puis ouvertes avec l'app du
// système (commandes Rust de `attachments.rs`). En cas d'échec, la promesse est rejetée avec
// un code : `type_refused` (programme, script…), `too_large`, `write_failed`, `open_failed`…
import { invoke } from "@tauri-apps/api/core";

/** Le contenu part tel quel, sans JSON : un PDF de quelques Mo reste léger. */
export const openFile = (serviceId: string, name: string, bytes: Uint8Array) =>
  invoke<void>("attachment_open", bytes, {
    headers: { service: serviceId, name: encodeURIComponent(name) },
  });

/** Efface les fichiers déjà ouverts d'un service délié ou d'un compte retiré. */
export const forgetFiles = (serviceId: string) =>
  invoke<void>("attachments_forget", { service: serviceId });
