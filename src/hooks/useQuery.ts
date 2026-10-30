// Lectures de la base partagées par les écrans. Chaque résultat reste en mémoire, par clé :
// revenir sur une page l'affiche tout de suite, et il n'est relu que si un de ses sujets a
// changé depuis (synchro, tâche cochée…, `useSyncStore`). Deux écrans qui lisent la même chose
// en même temps ne font qu'une lecture.
import { useEffect, useState, useSyncExternalStore } from "react";

import { stampOf, type Topic, useSyncStore } from "@/stores/sync";

import type { Loaded } from "./useLoaded";

/** Clés gardées par source ; au-delà, les plus anciennes sont oubliées (semaines parcourues). */
const LIMIT = 20;

const LOADING: Loaded<never> = { status: "loading" };

interface Entry<T> {
  /** Versions des sujets au moment de la lecture (`stampOf`). */
  stamp: string;
  /** Le dernier résultat ; pendant une relecture, le précédent reste affiché. */
  loaded?: Loaded<T>;
  loading: boolean;
}

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
): Loaded<T> {
  const stamp = useSyncStore(stampOf(source.topics));
  const loaded = useSyncExternalStore(source.subscribe, () => source.get(key));
  const [shown, setShown] = useState(loaded);
  if (loaded && loaded !== shown) {
    setShown(loaded);
  }
  useEffect(() => {
    source.refresh(key, stamp, load);
    // `load` est recréée à chaque rendu : `key` dit quand elle change vraiment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, key, stamp]);
  return loaded ?? shown ?? LOADING;
}
