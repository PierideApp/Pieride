// État de la synchronisation, partagé par l'interface. `version` change après chaque synchro
// (ou `reload`) : les hooks de données relisent alors la base.
import { create } from "zustand";

import { accountManager } from "@/services";

interface SyncState {
  version: number;
  syncing: boolean;
  /** Vrai si la base a refusé d'écrire ; un service en panne est noté dans `sync_state`. */
  failed: boolean;
  sync: (accountId: string) => Promise<void>;
  /** La base a changé hors synchro (compte créé) : les hooks la relisent. */
  reload: () => void;
}

export const useSyncStore = create<SyncState>()((set, get) => ({
  version: 0,
  syncing: false,
  failed: false,
  reload: () => set(state => ({ version: state.version + 1 })),
  sync: async accountId => {
    if (get().syncing) {
      return;
    }
    set({ syncing: true });
    try {
      await accountManager.refreshAll(accountId);
      set({ failed: false });
    } catch {
      set({ failed: true });
    } finally {
      set(state => ({ syncing: false, version: state.version + 1 }));
    }
  },
}));
