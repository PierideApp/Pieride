import { useEffect, useState } from "react";

import { useSyncStore } from "@/stores/sync";

export type Loaded<T> =
  { status: "loading" } | { status: "error" } | { status: "ready"; data: T };

/**
 * Lit la base pour un écran : lance `load` au montage, puis quand `key` change ou après
 * chaque synchronisation (version des données).
 */
export function useLoaded<T>(load: () => Promise<T>, key: string): Loaded<T> {
  const version = useSyncStore(state => state.version);
  const [state, setState] = useState<Loaded<T>>({ status: "loading" });
  useEffect(() => {
    let current = true;
    load().then(
      data => current && setState({ status: "ready", data }),
      () => current && setState({ status: "error" })
    );
    return () => {
      current = false;
    };
    // `load` est recréée à chaque rendu : `key` dit quand elle change vraiment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);
  return state;
}
