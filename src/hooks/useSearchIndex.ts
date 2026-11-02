// Ce que la palette de commandes cherche (`Ctrl/⌘ K`) : les tâches, cours, notes et actualités
// déjà enregistrés dans la base, toutes dates confondues. Relu quand une de ces données change.
// Une semaine jamais synchronisée ni visitée n'y est pas : la recherche ne demande rien au service.
import { type GradeView, loadGrades } from "./useGrades";
import { type HomeworkView, loadHomework } from "./useHomework";
import { loadNews, type NewsView } from "./useNews";
import { Source, useQuery } from "./useQuery";
import { type CourseView, loadCourses } from "./useTimetable";

export interface SearchIndex {
  homework: HomeworkView[];
  courses: CourseView[];
  grades: GradeView[];
  news: NewsView[];
}

export const EMPTY_INDEX: SearchIndex = {
  homework: [],
  courses: [],
  grades: [],
  news: [],
};

/** Toutes les dates : Tâches et Cours se lisent d'habitude semaine par semaine. */
const FIRST = new Date(0);
const LAST = new Date(9999, 0, 1);

async function loadIndex(accountId: string): Promise<SearchIndex> {
  const [homework, courses, { grades }, news] = await Promise.all([
    loadHomework(accountId, FIRST, LAST),
    loadCourses(accountId, FIRST, LAST),
    loadGrades(accountId),
    loadNews(accountId),
  ]);
  return { homework, courses, grades, news };
}

const source = new Source<SearchIndex>(
  "homework",
  "courses",
  "grades",
  "news",
  "subjects"
);

/** Rien n'est lu sans `accountId` : la palette ne le donne qu'une fois ouverte. */
export function useSearchIndex(accountId: string | undefined) {
  return useQuery(source, `${accountId}`, () =>
    accountId ? loadIndex(accountId) : Promise.resolve(EMPTY_INDEX)
  );
}
