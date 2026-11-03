// Cherche une mise à jour au lancement puis toutes les 6 heures, tant que le réglage est actif.
// Seulement vérifier : l'installation attend un clic (Paramètres > Démarrage et fenêtre).
import { useEffect } from "react";

import { useSettingsStore } from "@/stores/settings";
import { useUpdateStore } from "@/stores/update";

const UPDATE_INTERVAL = 6 * 60 * 60 * 1000;

export function useAutoUpdate() {
  const enabled = useSettingsStore(state => state.autoUpdate);
  const check = useUpdateStore(state => state.check);
  useEffect(() => {
    // En dev, aucune version publiée à comparer : le bouton des Paramètres reste là.
    if (!enabled || import.meta.env.DEV) {
      return;
    }
    check(true);
    const timer = setInterval(() => check(true), UPDATE_INTERVAL);
    return () => clearInterval(timer);
  }, [enabled, check]);
}
