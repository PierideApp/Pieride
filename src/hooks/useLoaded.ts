import { useEffect, useState } from "react";

export type Loaded<T> =
  { status: "loading" } | { status: "error" } | { status: "ready"; data: T };

/**
 * Lit une valeur du système (version de l'app, démarrage automatique) au montage, puis quand
 * `key` change. Pour la base, `useQuery` garde les résultats et les relit après une synchro.
 */
export function useLoaded<T>(load: () => Promise<T>, key: string): Loaded<T> {
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
  }, [key]);
  return state;
}
