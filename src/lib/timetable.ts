// Mise en page de l'emploi du temps (Cours) : plage horaire de la grille, cours qui se
// chevauchent côte à côte, pauses entre deux cours. Les heures sont locales, en minutes
// depuis minuit.

interface Timed {
  from: Date;
  to: Date;
}

/** Minutes depuis minuit, heure locale. */
export function minutesOf(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Les heures pleines affichées par la grille : de 8 h à 17 h au moins (maquettes), élargies pour qu'aucun
 * cours ne dépasse.
 */
export function hourRange(
  items: readonly Timed[],
  first = 8,
  last = 17
): { first: number; last: number } {
  return items.reduce(
    (range, item) => ({
      first: Math.min(range.first, Math.floor(minutesOf(item.from) / 60)),
      last: Math.max(range.last, Math.ceil(minutesOf(item.to) / 60)),
    }),
    { first, last }
  );
}

export interface Placed<T> {
  item: T;
  /** Début et fin en minutes depuis minuit. */
  start: number;
  end: number;
  /** Colonne du cours et nombre de colonnes de son groupe de cours qui se chevauchent. */
  column: number;
  columns: number;
}

/**
 * Place les cours d'une journée : ceux qui se chevauchent se partagent la largeur, chacun dans
 * la première colonne libre de leur groupe.
 */
export function placeDay<T extends Timed>(items: readonly T[]): Placed<T>[] {
  const sorted = items
    .map(item => ({
      item,
      start: minutesOf(item.from),
      // Au moins un quart d'heure : un cours de durée nulle resterait visible.
      end: Math.max(minutesOf(item.to), minutesOf(item.from) + 15),
    }))
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const placed: Placed<T>[] = [];
  let group: Placed<T>[] = [];
  let columnEnds: number[] = [];
  let groupEnd = -1;
  const closeGroup = () => {
    for (const course of group) {
      course.columns = columnEnds.length;
    }
    group = [];
    columnEnds = [];
  };
  for (const course of sorted) {
    if (course.start >= groupEnd) {
      closeGroup();
    }
    let column = columnEnds.findIndex(end => end <= course.start);
    if (column === -1) {
      column = columnEnds.length;
    }
    columnEnds[column] = course.end;
    groupEnd = Math.max(groupEnd, course.end);
    const entry = { ...course, column, columns: 1 };
    group.push(entry);
    placed.push(entry);
  }
  closeGroup();
  return placed;
}

export type DayEntry<T> =
  | { kind: "course"; item: T }
  | { kind: "break"; from: Date; to: Date; lunch: boolean };

/** Une pause plus courte n'est pas affichée : le temps de changer de salle. */
const MIN_BREAK = 10;

/**
 * Les cours d'une journée dans l'ordre, avec les pauses entre eux. Une pause d'au moins
 * 45 minutes qui touche la plage 12 h à 14 h est la pause méridienne.
 */
export function withBreaks<T extends Timed>(
  items: readonly T[]
): DayEntry<T>[] {
  const sorted = [...items].sort((a, b) => a.from.getTime() - b.from.getTime());
  const entries: DayEntry<T>[] = [];
  let lastEnd: Date | null = null;
  for (const item of sorted) {
    if (lastEnd && minutesOf(item.from) - minutesOf(lastEnd) >= MIN_BREAK) {
      const start = minutesOf(lastEnd);
      const end = minutesOf(item.from);
      entries.push({
        kind: "break",
        from: lastEnd,
        to: item.from,
        lunch: end - start >= 45 && start < 14 * 60 && end > 12 * 60,
      });
    }
    entries.push({ kind: "course", item });
    if (!lastEnd || item.to > lastEnd) {
      lastEnd = item.to;
    }
  }
  return entries;
}
