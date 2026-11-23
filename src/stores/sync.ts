// État de la synchronisation, partagé par l'interface. Chaque sujet de la base a sa version,
// qui change après chaque synchro (tous les sujets) ou `reload` (ceux qui ont changé) : les
// hooks de données relisent alors ce qu'ils lisent, et seulement ça (`useQuery`).
import { create } from "zustand";

import i18n from "@/lib/i18n";
import { log } from "@/lib/log";
import { accountManager } from "@/services";
import { MANUAL_SYNC_INTERVAL } from "@/services/account-manager";
import type { Capability } from "@/services/shared/plugin";

import { useSettingsStore } from "./settings";

/**
 * Ce que les écrans lisent dans la base ; `sync` : les dates de dernière synchro,
 * `downloads` : les pièces jointes téléchargées.
 */
export const TOPICS = [
  "accounts",
  "courses",
  "homework",
  "grades",
  "news",
  "attendance",
  "subjects",
  "sync",
  "downloads",
] as const;

export type Topic = (typeof TOPICS)[number];

type Versions = Record<Topic, number>;

/** Un compte et les données de ses modules affichés (`syncedCapabilities` du registre). */
export interface SyncTarget {
  accountId: string;
  capabilities: readonly Capability[];
}

interface SyncState {
  versions: Versions;
  syncing: boolean;
  /** Vrai si la base a refusé d'écrire ; un service en panne est noté dans `sync_state`. */
  failed: boolean;
  /**
   * Redemande les données plus vieilles que `interval` (30 minutes par défaut), compte après
   * compte : chaque connexion renouvelle le jeton du service, même d'un compte qu'on n'ouvre pas.
   */
  sync: (targets: readonly SyncTarget[], interval?: number) => Promise<void>;
  /** Le dernier `Ctrl R` accepté, et le dernier refusé (moins de 5 minutes après). */
  manualAt: number | null;
  refusedAt: number | null;
  /**
   * `Ctrl R` : une synchro au plus toutes les 5 minutes, même quand le service échoue (une
   * synchro en échec ne date rien dans la base : sans ce délai, chaque appui le redemanderait).
   */
  syncNow: (target: SyncTarget, now?: number) => void;
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

/** La synchro demandée pendant une autre, lancée à sa fin (un module réaffiché entre-temps). */
let queued: { targets: readonly SyncTarget[]; interval?: number } | null = null;

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
    downloads: 0,
  },
  syncing: false,
  failed: false,
  manualAt: null,
  refusedAt: null,
  reload: (...topics) =>
    set(state => ({
      versions: bump(state.versions, topics.length > 0 ? topics : TOPICS),
    })),
  syncNow: (target, now = Date.now()) => {
    const { syncing, manualAt } = get();
    if (syncing) {
      return;
    }
    // `abs` : une horloge reculée ne bloque pas `Ctrl R` jusqu'à ce qu'elle rattrape.
    if (manualAt !== null && Math.abs(now - manualAt) < MANUAL_SYNC_INTERVAL) {
      set({ refusedAt: now });
      return;
    }
    set({ manualAt: now, refusedAt: null });
    accountManager.allowAuthRetries();
    void get().sync([target], MANUAL_SYNC_INTERVAL);
  },
  sync: async (targets, interval) => {
    if (get().syncing) {
      queued = { targets, interval };
      return;
    }
    set({ syncing: true });
    let failed = false;
    for (const { accountId, capabilities } of targets) {
      try {
        await accountManager.refreshAll(
          accountId,
          capabilities,
          new Date(),
          interval
        );
      } catch (error) {
        failed = true;
        // Le type d'erreur seulement : le détail de chaque service est dans `sync_state`.
        log(
          "error",
          "sync",
          `Synchronisation en échec : ${error instanceof Error ? error.name : "Unknown"}`
        );
      }
      // Le premier compte est celui affiché : ses données s'affichent sans attendre les autres.
      set(state => ({ versions: bump(state.versions, TOPICS) }));
      // Après l'affichage. Attendu : aucune synchro ne repart pendant les téléchargements, et
      // PRONOTE numérote ses requêtes.
      if (useSettingsStore.getState().autoDownload) {
        await accountManager
          .saveNewAttachments(accountId, {
            cours: i18n.t("modules.cours"),
            taches: i18n.t("modules.taches"),
            actualites: i18n.t("modules.actualites"),
          })
          .then(
            saved =>
              saved &&
              set(state => ({
                versions: bump(state.versions, ["downloads"]),
              })),
            (error: unknown) =>
              log(
                "error",
                "fichiers",
                `Téléchargement automatique en échec : ${error instanceof Error ? error.name : "Unknown"}`
              )
          );
      }
    }
    if (!failed) {
      log("info", "sync", "Synchronisation terminée");
    }
    set({ syncing: false, failed });
    const next = queued;
    queued = null;
    if (next) {
      void get().sync(next.targets, next.interval);
    }
  },
}));
