// Recherche de la palette dans les données de l'élève (hooks/useSearchIndex) : chaque mot tapé
// doit apparaître, sans accents ni majuscules (lib/search), et chaque module garde ses
// `PER_MODULE` premiers résultats. Tâches et cours au plus près d'aujourd'hui d'abord, notes
// et actualités les plus récentes d'abord.
import { EMPTY_INDEX, type SearchIndex } from "@/hooks/useSearchIndex";
import { matches } from "@/lib/search";

export const PER_MODULE = 5;

/** Lettres à taper avant de chercher dans les données : une seule en trouverait trop. */
export const MIN_LENGTH = 2;

function pick<T>(
  items: readonly T[],
  query: string,
  text: (item: T) => string,
  order: (a: T, b: T) => number
): T[] {
  return items
    .filter(item => matches(text(item), query))
    .sort(order)
    .slice(0, PER_MODULE);
}

export function searchIndex(
  index: SearchIndex,
  query: string,
  now: Date
): SearchIndex {
  if (query.trim().length < MIN_LENGTH) {
    return EMPTY_INDEX;
  }
  const near = (date: Date) => Math.abs(date.getTime() - now.getTime());
  return {
    homework: pick(
      index.homework,
      query,
      item => `${item.label} ${item.content}`,
      (a, b) => near(a.dueAt) - near(b.dueAt)
    ),
    courses: pick(
      index.courses,
      query,
      course =>
        [
          course.label,
          course.teacher,
          course.room,
          ...(course.contents ?? []).flatMap(content => [
            content.title,
            content.description,
          ]),
        ].join(" "),
      (a, b) => near(a.from) - near(b.from)
    ),
    grades: pick(
      index.grades,
      query,
      grade => `${grade.label} ${grade.title}`,
      (a, b) => b.date.getTime() - a.date.getTime()
    ),
    news: pick(
      index.news,
      query,
      item => `${item.title ?? ""} ${item.author} ${item.content}`,
      (a, b) => b.date.getTime() - a.date.getTime()
    ),
  };
}
