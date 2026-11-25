// Les mises à jour de Piéride (tauri-plugin-updater) : une vérification, un téléchargement
// signé, puis un redémarrage. Un seul état partagé par la vérification automatique (Layout) et
// la ligne des Paramètres. Seul le lancement installe sans clic (réglage `autoInstall`).
import { invoke } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { create } from "zustand";

import { report } from "@/lib/log";
import { platformName } from "@/lib/platform";
import { closeLogins, reopenLogins } from "@/services/shared/auth";

export type UpdateState =
  | { status: "idle" } // aucune vérification n'a été faite depuis le lancement
  | { status: "checking" } // vérification en cours (automatique ou manuelle)
  | { status: "upToDate"; checkedAt: number } // la version actuelle est à jour
  /** `manual` : installé par un paquet (.deb, .rpm), que seul le système peut remplacer. */
  | { status: "available"; version: string; manual: boolean } // une mise à jour est disponible, mais pas encore téléchargée
  /** `progress` : de 0 à 1, ou null tant que la taille du fichier est inconnue. */
  | {
      status: "downloading";
      version: string;
      progress: number | null;
      done: number;
      total: number;
    } // téléchargement en cours
  | { status: "installing"; version: string } // Linux : l'installation est en cours (l'app se remplace elle-même)
  | { status: "installReady"; version: string } // Windows : l'installation est prête, l'app doit se fermer pour lancer l'installateur
  | { status: "restartReady"; version: string } // Linux : l'installation est terminée, l'app doit redémarrer pour utiliser la nouvelle version
  | { status: "error" }; // une erreur est survenue (hors ligne, jeton expiré, etc.) : l'état reste inchangé jusqu'à la prochaine vérification

interface UpdateStore {
  state: UpdateState;
  /** `silent` : en arrière-plan, une erreur (hors ligne…) ne change rien à l'écran. */
  check: (silent?: boolean) => Promise<void>;
  download: () => Promise<void>;
  install: () => Promise<void>;
  /** Au lancement : cherche, installe si l'app peut se remplacer elle-même, puis redémarre. */
  checkAndInstall: () => Promise<void>;
  downloadAndInstall: (forceInstall?: boolean) => Promise<void>;
  restart: () => Promise<void>;
}

/** La mise à jour trouvée par la dernière vérification, prête à être installée. */
let pending: Update | null = null;

export const useUpdateStore = create<UpdateStore>()((set, get) => ({
  state: { status: "idle" },
  check: async (silent = false) => {
    const before = get().state;
    if (
      ["checking", "downloading", "installReady", "restartReady"].includes(
        before.status
      )
    ) {
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
    set({
      state: { status: "downloading", version, progress: null, done, total },
    });
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
              total,
            },
          });
        }
      });
    } catch (error) {
      report("update", error);
      set({ state: { status: "error" } });
    }
  },
  install: async () => {
    const { state } = get();
    if (
      (state.status !== "installReady" && state.status !== "downloading") ||
      !pending
    ) {
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

    await get().downloadAndInstall(true);
    if (get().state.status === "restartReady") {
      await get().restart();
    }
  },
  downloadAndInstall: async (forceInstall?: boolean) => {
    const { state } = get();
    if (state.status !== "available") {
      return;
    }

    await get().download();
    if (platformName !== "Windows" || forceInstall) {
      await get().install();
    } else {
      set({ state: { status: "installReady", version: state.version } });
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
