// Journal de l'app (Paramètres > Développeur), en mémoire seulement : jamais écrit sur le
// disque ni envoyé. Tout message passe par `redact` ; une requête ne garde que son domaine.

export interface LogEntry {
  /** Unique pendant la session (clé React). */
  id: number;
  time: Date;
  level: "info" | "warn" | "error";
  /** D'où vient le message : `sync`, `http`, `app`… */
  source: string;
  message: string;
}

export interface RequestEntry {
  id: number;
  time: Date;
  method: string;
  /** Le domaine seulement : le chemin et la query string peuvent porter un jeton. */
  host: string;
  /** Absent si la requête n'a pas abouti. */
  status?: number;
  /** En millisecondes. */
  duration: number;
}

/** Les derniers éléments gardés, pour ne pas grossir sans fin. */
const MAX = 300;

let snapshot: {
  entries: readonly LogEntry[];
  requests: readonly RequestEntry[];
  /** Toutes les requêtes depuis le lancement, même celles qui ne sont plus gardées. */
  requestCount: number;
} = { entries: [], requests: [], requestCount: 0 };
const listeners = new Set<() => void>();
let nextId = 0;

function update(next: typeof snapshot) {
  snapshot = next;
  listeners.forEach(listener => listener());
}

/**
 * Masque ce qui pourrait être un secret : identifiants et paramètres d'URL, longues suites de
 * lettres et de chiffres (jetons, cookies).
 */
export function redact(text: string): string {
  return text
    .replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]*@/gi, "$1***@")
    .replace(/\b([a-z][a-z0-9+.-]*:\/\/[^\s?#]*)[?#]\S*/gi, "$1?***")
    .replace(/[A-Za-z0-9+/_=-]{20,}/g, "***");
}

export function log(
  level: LogEntry["level"],
  source: string,
  message: string
): void {
  update({
    ...snapshot,
    entries: [
      ...snapshot.entries.slice(1 - MAX),
      {
        id: nextId++,
        time: new Date(),
        level,
        source,
        message: redact(message),
      },
    ],
  });
}

export function logRequest(entry: Omit<RequestEntry, "id" | "time">): void {
  update({
    ...snapshot,
    requests: [
      ...snapshot.requests.slice(1 - MAX),
      { ...entry, id: nextId++, time: new Date() },
    ],
    requestCount: snapshot.requestCount + 1,
  });
}

/** Pour `useSyncExternalStore`. */
export const subscribeLog = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getLog = () => snapshot;

/** Le journal en texte, pour le copier dans un signalement. */
export function logText(): string {
  return snapshot.entries
    .map(
      ({ time, level, source, message }) =>
        `${time.toISOString()} ${level.toUpperCase()} ${source} ${message}`
    )
    .join("\n");
}

/**
 * Signale une erreur attrapée : en entier dans la console de la WebView, pour déboguer, et
 * masquée dans le journal (`redact`), pour un signalement. Seulement pour les erreurs de la base
 * ou du système, qui ne portent qu'un code : celles d'un service passent par leur type.
 */
export function report(source: string, error: unknown): void {
  console.error(error);
  log("error", source, error instanceof Error ? error.name : String(error));
}
