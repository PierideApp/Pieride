// Cherche une mise à jour au lancement puis toutes les 6 heures, tant que le réglage est actif.
// Avec `autoInstall`, celle trouvée au lancement est installée et l'app redémarre. Jamais plus
// tard : sur Windows, l'installation ferme l'app, ce qu'on ne veut pas en pleine utilisation.
import { useEffect } from "react";

import { useSettingsStore } from "@/stores/settings";
import { useUpdateStore } from "@/stores/update";

const UPDATE_INTERVAL = 6 * 60 * 60 * 1000;

/** Vrai jusqu'au premier passage : un seul lancement par processus, même si Layout remonte. */
let atLaunch = true;

export function useAutoUpdate() {
  const enabled = useSettingsStore(state => state.autoUpdate);
  const check = useUpdateStore(state => state.check);
  const checkAndInstall = useUpdateStore(state => state.checkAndInstall);
  useEffect(() => {
    const launching = atLaunch;
    atLaunch = false;
    // En dev, aucune version publiée à comparer : le bouton des Paramètres reste là.
    if (!enabled || import.meta.env.DEV) {
      return;
    }
    // Lu ici et non suivi : l'activer en cours de route n'installe rien avant le prochain lancement.
    if (launching && useSettingsStore.getState().autoInstall) {
      checkAndInstall();
    } else {
      check(true);
    }
    const timer = setInterval(() => check(true), UPDATE_INTERVAL);
    return () => clearInterval(timer);
  }, [enabled, check, checkAndInstall]);
}
