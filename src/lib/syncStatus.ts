// L'état de la synchronisation montré dans la barre latérale.
// - « offline » : pas d'Internet ;
// - « failed » : Internet fonctionne mais rien n'a pu être synchronisé ;
// - « partial » : une partie seulement a été synchronisée (« Synchronisé », avec un avertissement) ;
// - « ok » : tout est synchronisé ; « never » : rien n'a encore été tenté.

export type SyncHealth = "never" | "ok" | "partial" | "failed" | "offline";

/** Ce que `sync_state` dit d'un compte : données à jour, et données dont la dernière synchro a échoué. */
export interface SyncCounts {
  ok: number;
  errors: number;
}

export function syncHealth(
  counts: SyncCounts | undefined,
  online: boolean,
  /** Vrai si la base a refusé d'écrire pendant la dernière synchro (`useSyncStore`). */
  databaseFailed = false
): SyncHealth {
  if (!online) {
    return "offline";
  }
  if (databaseFailed) {
    return "failed";
  }
  if (!counts) {
    return "never";
  }
  if (counts.errors > 0) {
    return counts.ok > 0 ? "partial" : "failed";
  }
  return counts.ok > 0 ? "ok" : "never";
}
