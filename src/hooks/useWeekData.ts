// Les données d'une semaine (Cours, Tâches) : lues dans la base comme les autres, et demandées
// au service quand ce n'est pas la semaine de la synchro (AccountManager, `loadWeek`).
import { useEffect, useMemo, useState } from "react";

import { log } from "@/lib/log";
import { addDays, weekStart } from "@/lib/week";
import { accountManager } from "@/services";
import { useSyncStore } from "@/stores/sync";

import { type Query, type Source, useQuery } from "./useQuery";

/** Temps passé sur une semaine avant de la demander au service. */
const WEEK_DELAY = 500;

export function useWeekData<T>(
  source: Source<T[]>,
  accountId: string | undefined,
  week: Date,
  load: (accountId: string, from: Date, to: Date) => Promise<T[]>
): Query<T[]> {
  const reload = useSyncStore(state => state.reload);
  const monday = weekStart(week).getTime();
  const key = `${accountId}:${monday}`;
  /** La dernière semaine que le service a fini d'envoyer, ou de refuser. */
  const [answered, setAnswered] = useState<string>();

  useEffect(() => {
    if (!accountId) {
      return;
    }
    // Une semaine seulement traversée (« › » plusieurs fois) n'est pas demandée : PRONOTE
    // suspend les adresses qui envoient trop de requêtes.
    const timer = setTimeout(() => {
      void accountManager
        .loadWeek(accountId, new Date(monday))
        .then(
          changed => changed && reload("courses", "homework"),
          // Seule la base peut faire échouer `loadWeek` : l'écran l'affichera en la lisant.
          () => log("error", "sync", "Semaine non enregistrée dans la base")
        )
        .finally(() => setAnswered(`${accountId}:${monday}`));
    }, WEEK_DELAY);
    return () => clearTimeout(timer);
  }, [accountId, monday, reload]);

  const query = useQuery(source, key, () =>
    accountId
      ? load(accountId, new Date(monday), addDays(new Date(monday), 7))
      : Promise.resolve([])
  );
  // La semaine de la synchro n'est pas demandée à part (`loadWeek` ne fait rien pour elle).
  const asking =
    accountId !== undefined &&
    answered !== key &&
    monday !== weekStart(new Date()).getTime();
  return useMemo(
    () => (asking && !query.fetching ? { ...query, fetching: true } : query),
    [query, asking]
  );
}
