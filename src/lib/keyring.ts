// Secrets des services dans le trousseau du système (commandes Rust de `secrets.rs`).
// Jamais ailleurs : ni base, ni store, ni localStorage, ni journaux.
// En cas d'échec, la promesse est rejetée avec un code : `invalid_id`, `too_long`,
// `keyring_unavailable` (pas de trousseau, fréquent sous Linux minimal) ou `keyring_error`.
import { invoke } from "@tauri-apps/api/core";

export const getSecret = (id: string) =>
  invoke<string | null>("secret_get", { id });

export const setSecret = (id: string, value: string) =>
  invoke<void>("secret_set", { id, value });

export const deleteSecret = (id: string) =>
  invoke<void>("secret_delete", { id });
