// État de la synchronisation, partagé par l'interface. Chaque sujet de la base a sa version,
// qui change après chaque synchro (tous les sujets) ou `reload` (ceux qui ont changé) : les
// hooks de données relisent alors ce qu'ils lisent, et seulement ça (`useQuery`).
import { create } from "zustand";

import { log } from "@/lib/log";
import { accountManager } from "@/services";

/** Ce que les écrans lisent dans la base ; `sync` : les dates de dernière synchro. */
export const TOPICS = [
  "accounts",
  "courses",
  "homework",
  "grades",
  "news",
  "attendance",
  "subjects",
  "sync",
] as const;

export type Topic = (typeof TOPICS)[number];

type Versions = Record<Topic, number>;

interface SyncState {
  versions: Versions;
  syncing: boolean;
  /** Vrai si la base a refusé d'écrire ; un service en panne est noté dans `sync_state`. */
  failed: boolean;
  sync: (accountId: string) => Promise<void>;
  /** La base a changé hors synchro : ces sujets sont relus, tous si on n'en donne aucun. */
  reload: (...topics: Topic[]) => void;
}

const bump = (versions: Versions, topics: readonly Topic[]): Versions => {
  const next = { ...versions };
  for (const topic of topics) {
    next[topic] += 1;
  }
  return next;
};

/** Les versions de `topics`, en une chaîne qui change dès que l'une d'elles change. */
export const stampOf = (topics: readonly Topic[]) => (state: SyncState) =>
  topics.map(topic => state.versions[topic]).join();

export const useSyncStore = create<SyncState>()((set, get) => ({
  versions: {
    accounts: 0,
    courses: 0,
    homework: 0,
    grades: 0,
    news: 0,
    attendance: 0,
    subjects: 0,
    sync: 0,
  },
  syncing: false,
  failed: false,
  reload: (...topics) =>
    set(state => ({
      versions: bump(state.versions, topics.length > 0 ? topics : TOPICS),
    })),
  sync: async accountId => {
    if (get().syncing) {
      return;
    }
    set({ syncing: true });
    try {
      await accountManager.refreshAll(accountId);
      set({ failed: false });
      log("info", "sync", "Synchronisation terminée");
    } catch (error) {
      set({ failed: true });
      // Le type d'erreur seulement : le détail de chaque service est dans `sync_state`.
      log(
        "error",
        "sync",
        `Synchronisation en échec : ${error instanceof Error ? error.name : "Unknown"}`
      );
    } finally {
      set(state => ({
        syncing: false,
        versions: bump(state.versions, TOPICS),
      }));
    }
  },
}));
