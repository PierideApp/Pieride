// Les mises à jour de Piéride (tauri-plugin-updater) : une vérification, un téléchargement
// signé, puis un redémarrage. Un seul état partagé par la vérification automatique (Layout) et
// la ligne des Paramètres. Seul le lancement installe sans clic (réglage `autoInstall`).
import { invoke } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { platformName } from "@/lib/platform";
import { create } from "zustand";

import { report } from "@/lib/log";
import { closeLogins, reopenLogins } from "@/services/shared/auth";

export type UpdateState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "upToDate"; checkedAt: number }
  /** `manual` : installé par un paquet (.deb, .rpm), que seul le système peut remplacer. */
  | { status: "available"; version: string; manual: boolean }
  /** `progress` : de 0 à 1, ou null tant que la taille du fichier est inconnue. */
  | { status: "downloading"; version: string; progress: number | null, done?: number; total?: number }
  | { status: "installing"; version: string }
  | { status: "installReady"; version: string }
  | { status: "restartReady"; version: string }
  | { status: "error" };

interface UpdateStore {
  state: UpdateState;
  /** `silent` : en arrière-plan, une erreur (hors ligne…) ne change rien à l'écran. */
  check: (silent?: boolean) => Promise<void>;
  download: () => Promise<void>;
  install: () => Promise<void>;
  /** Au lancement : cherche, installe si l'app peut se remplacer elle-même, puis redémarre. */
  checkAndInstall: () => Promise<void>;
  restart: () => Promise<void>;
}

/** La mise à jour trouvée par la dernière vérification, prête à être installée. */
let pending: Update | null = null;

export const useUpdateStore = create<UpdateStore>()((set, get) => ({
  state: { status: "idle" },
  check: async (silent = false) => {
    const before = get().state;
    if (["checking", "downloading", "installReady", "restartReady"].includes(before.status)) {
      return;
    }
    set({ state: { status: "checking" } });
    try {
      const update = await check();
      pending = update;
      set({
        state: update
          ? {
              status: "available",
              version: update.version,
              manual: !(await invoke<boolean>("can_self_update")),
            }
          : { status: "upToDate", checkedAt: Date.now() },
      });
    } catch (error) {
      report("update", error);
      set({ state: silent ? before : { status: "error" } });
    }
  },
  download: async () => {
    const { state } = get();
    if (state.status !== "available" || !pending) {
      return;
    }
    const { version } = state;
    let total = 0;
    let done = 0;
    set({ state: { status: "downloading", version, progress: null } });
    try {
      await pending.download(event => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          done += event.data.chunkLength;
          set({
            state: {
              status: "downloading",
              version,
              progress: total > 0 ? Math.min(done / total, 1) : null,
              done,
              total
            },
          });
        }
      });
      // Pas d'installation automatique sur Windows : l'installeur ferme l'app et la rouvre lui-même.
      if (platformName === "Windows") {
        set({ state: { status: "installReady", version } });
      }
      else get().install();
    } catch (error) {
      report("update", error);
      set({ state: { status: "error" } });
    }
  },
  install: async () => {
    const { state } = get();
    if ((state.status !== "installReady" && state.status !== "downloading") || !pending) {
      return;
    }
    const { version } = state;
    set({ state: { status: "installing", version } });
    try {
      // Sur Windows, l'installation quitte l'app : pas en pleine connexion, le jeton se perdrait.
      await closeLogins();
      try {
        await pending.install();
      } finally {
        // Ailleurs, l'app continue jusqu'au redémarrage et doit encore se synchroniser.
        reopenLogins();
      }
      set({ state: { status: "restartReady", version } });
    } catch (error) {
      report("update", error);
      set({ state: { status: "error" } });
    }
  },
  checkAndInstall: async () => {
    await get().check(true);
    const { state } = get();
    if (state.status !== "available" || state.manual) {
      return;
    }
    // Sur Windows, l'installeur ferme l'app et la rouvre lui-même : on n'arrive pas ici.
    await get().install();
    if (get().state.status === "restartReady") {
      await get().restart();
    }
  },
  restart: async () => {
    await closeLogins();
    try {
      await invoke("restart_app");
    } catch (error) {
      reopenLogins();
      report("update", error);
    }
  },
}));
