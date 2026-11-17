// En ligne d'après le système (`navigator.onLine`), sans requête vers un serveur tiers. Windows
// peut se dire en ligne sur un Wi-Fi sans Internet : la synchro en échec le dira alors.
import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export const useOnline = () =>
  useSyncExternalStore(subscribe, () => navigator.onLine);
