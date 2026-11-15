import { useEffect } from "react";

import { useNetworkStore } from "@/stores/network";

// Windows can report a network connection even when the Internet is unavailable. Google's
// connectivity check returns HTTP 204 only when Internet access works.
const CONNECTIVITY_CHECK_URL =
  "https://connectivitycheck.gstatic.com/generate_204";
const CONNECTIVITY_CHECK_INTERVAL = 30_000;
const CONNECTIVITY_CHECK_TIMEOUT = 5_000;

const setOnline = (online: boolean) => useNetworkStore.setState({ online });

/** Vérifie la connexion toutes les 30 secondes et au retour sur la fenêtre (`useNetworkStore`). */
export function useConnectivityMonitor() {
  useEffect(() => {
    let active = true;
    let checking = false;
    let controller: AbortController | undefined;
    const checkInternet = async () => {
      if (checking) {
        return;
      }
      if (!navigator.onLine) {
        setOnline(false);
        return;
      }

      checking = true;
      controller = new AbortController();
      const timeout = window.setTimeout(
        () => controller?.abort(),
        CONNECTIVITY_CHECK_TIMEOUT
      );
      try {
        const response = await fetch(CONNECTIVITY_CHECK_URL, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (active) {
          setOnline(response.status === 204);
        }
      } catch {
        if (active) {
          setOnline(false);
        }
      } finally {
        window.clearTimeout(timeout);
        checking = false;
      }
    };
    const onOnline = () => void checkInternet();
    const onOffline = () => {
      controller?.abort();
      setOnline(false);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("focus", onOnline);
    void checkInternet();
    const interval = window.setInterval(
      () => void checkInternet(),
      CONNECTIVITY_CHECK_INTERVAL
    );
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(interval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("focus", onOnline);
    };
  }, []);
}
