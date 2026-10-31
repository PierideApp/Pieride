// Les matières d'un compte telles que l'app les affiche : Paramètres > Matières aujourd'hui,
// Cours et Notes ensuite. Relues après chaque synchronisation ou modification.
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { useTranslation } from "react-i18next";

import { db } from "@/database";
import { courses, services, subjects } from "@/database/schema";
import { resolveSubjects, type SubjectView } from "@/lib/subjects";

import { Source, useQuery } from "./useQuery";

async function loadSubjects(accountId: string, locale: string) {
  const [rows, taught] = await Promise.all([
    db
      .select({
        name: subjects.name,
        displayName: subjects.displayName,
        color: subjects.color,
        emoji: subjects.emoji,
      })
      .from(subjects)
      .innerJoin(services, eq(services.id, subjects.serviceId))
      .where(eq(services.accountId, accountId)),
    db
      .select({ subject: courses.subject, teacher: courses.teacher })
      .from(courses)
      .innerJoin(services, eq(services.id, courses.serviceId))
      .where(and(eq(services.accountId, accountId), isNotNull(courses.teacher)))
      .orderBy(desc(courses.from)),
  ]);
  return resolveSubjects(rows, taught, locale);
}

// Les enseignants viennent des cours.
const source = new Source<SubjectView[]>("subjects", "courses");

export function useSubjects(accountId: string | undefined) {
  const { i18n } = useTranslation();
  return useQuery(source, `${accountId}:${i18n.language}`, () =>
    accountId ? loadSubjects(accountId, i18n.language) : Promise.resolve([])
  );
}
