// Une recherche lancée après une pause de frappe (ville, adresse…). La réponse d'une
// recherche dépassée est ignorée ; une requête vide ne cherche rien.
import { useEffect, useState } from "react";

export type Lookup<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "ready"; data: T };

/** `find` doit garder la même identité d'un rendu à l'autre (fonction d'un module). */
export function useLookup<T>(
  query: string,
  find: (query: string) => Promise<T>,
  delay = 400
): Lookup<T> {
  const [result, setResult] = useState<{
    query: string;
    lookup: Lookup<T>;
  } | null>(null);
  useEffect(() => {
    if (!query) {
      return;
    }
    let current = true;
    const timer = setTimeout(() => {
      find(query).then(
        data =>
          current && setResult({ query, lookup: { status: "ready", data } }),
        (error: unknown) =>
          current && setResult({ query, lookup: { status: "error", error } })
      );
    }, delay);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, find, delay]);
  if (!query) {
    return { status: "idle" };
  }
  return result?.query === query ? result.lookup : { status: "loading" };
}
