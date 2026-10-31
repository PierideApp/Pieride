// Lectures de la base partagées par les écrans. Chaque résultat reste en mémoire, par clé :
// revenir sur une page l'affiche tout de suite, et il n'est relu que si un de ses sujets a
// changé depuis (synchro, tâche cochée…, `useSyncStore`). Deux écrans qui lisent la même chose
// en même temps ne font qu'une lecture. `fetching` dit qu'une donnée est en route : un écran
// qui n'a rien à montrer attend alors, au lieu d'afficher son état vide.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { stampOf, type Topic, useSyncStore } from "@/stores/sync";

import type { Loaded } from "./useLoaded";

/** Clés gardées par source ; au-delà, les plus anciennes sont oubliées (semaines parcourues). */
const LIMIT = 20;

const LOADING: Loaded<never> = { status: "loading" };

export type Query<T> = Loaded<T> & {
  /** Le résultat peut encore changer : lecture de la base ou synchronisation en cours. */
  fetching: boolean;
};

interface Entry<T> {
  /** Versions des sujets au moment de la lecture (`stampOf`). */
  stamp: string;
  /** Le dernier résultat ; pendant une relecture, le précédent reste affiché. */
  loaded?: Loaded<T>;
  loading: boolean;
}

/** Pas encore lue, en cours de lecture, ou lue avant que ses sujets ne changent (`stamp`). */
export const isStale = (entry: Entry<unknown> | undefined, stamp: string) =>
  !entry?.loaded || entry.loading || entry.stamp !== stamp;

/** Une lecture de la base, relue quand un de ses sujets change. */
export class Source<T> {
  readonly topics: readonly Topic[];
  private readonly entries = new Map<string, Entry<T>>();
  private readonly listeners = new Set<() => void>();

  constructor(...topics: Topic[]) {
    this.topics = topics;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  get(key: string): Loaded<T> | undefined {
    return this.entries.get(key)?.loaded;
  }

  entry(key: string): Entry<T> | undefined {
    return this.entries.get(key);
  }

  /** Lit `key` si elle n'a jamais été lue, si la lecture a échoué ou si ses sujets ont changé. */
  refresh(key: string, stamp: string, load: () => Promise<T>) {
    const entry = this.entries.get(key);
    if (
      entry?.stamp === stamp &&
      (entry.loading || entry.loaded?.status === "ready")
    ) {
      return;
    }
    const next: Entry<T> = { stamp, loaded: entry?.loaded, loading: true };
    // Remise en dernier : les clés oubliées en premier sont celles lues il y a le plus longtemps.
    this.entries.delete(key);
    this.entries.set(key, next);
    for (const old of this.entries.keys()) {
      if (this.entries.size <= LIMIT) {
        break;
      }
      this.entries.delete(old);
    }
    this.emit();
    load().then(
      data => this.settle(key, next, { status: "ready", data }),
      () => this.settle(key, next, { status: "error" })
    );
  }

  private settle(key: string, entry: Entry<T>, loaded: Loaded<T>) {
    // Une lecture dépassée par une plus récente, ou oubliée entre-temps, ne compte plus.
    if (this.entries.get(key) !== entry) {
      return;
    }
    this.entries.set(key, { ...entry, loaded, loading: false });
    this.emit();
  }

  private emit() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

/**
 * Le résultat de `load` pour `key` dans `source`. Tant qu'une nouvelle clé (autre semaine,
 * autre compte) n'est pas lue, le résultat de la précédente reste affiché.
 */
export function useQuery<T>(
  source: Source<T>,
  key: string,
  load: () => Promise<T>
): Query<T> {
  const stamp = useSyncStore(stampOf(source.topics));
  const syncing = useSyncStore(state => state.syncing);
  const entry = useSyncExternalStore(source.subscribe, () => source.entry(key));
  const loaded = entry?.loaded;
  const [shown, setShown] = useState(loaded);
  if (loaded && loaded !== shown) {
    setShown(loaded);
  }
  useEffect(() => {
    source.refresh(key, stamp, load);
    // `load` est recréée à chaque rendu : `key` dit quand elle change vraiment.
  }, [source, key, stamp]);
  // Avant l'effet, `entry` peut dater d'avant le nouveau `stamp` : elle va être relue.
  const fetching = syncing || isStale(entry, stamp);
  const result = loaded ?? shown ?? LOADING;
  // Le même objet tant que rien ne change : des écrans le gardent dans un `useMemo`.
  return useMemo(() => ({ ...result, fetching }), [result, fetching]);
}
