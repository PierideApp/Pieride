// Ce que l'app sait d'Internet, mis à jour par `useConnectivityMonitor` (Layout) et lu par la
// bannière hors connexion et l'état de la synchronisation (barre latérale).
import { create } from "zustand";

interface NetworkState {
  online: boolean;
}

export const useNetworkStore = create<NetworkState>()(() => ({
  online: typeof navigator === "undefined" ? true : navigator.onLine,
}));
