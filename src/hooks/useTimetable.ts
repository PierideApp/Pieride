// Les cours d'une semaine pour un compte, avec le nom, la couleur et l'emoji de chaque
// matière (Paramètres > Matières). Relus après chaque synchronisation.
import { and, eq, gte, lt } from "drizzle-orm";

import { db } from "@/database";
import { courses, services, subjects } from "@/database/schema";
import { subjectLook } from "@/lib/subjects";
import type { Course, ServiceKind } from "@/services/shared/models";

import { Source } from "./useQuery";
import { useWeekData } from "./useWeekData";

/** Un cours tel que l'app l'affiche. */
export interface CourseView extends Course {
  /** Le service qui le fournit. */
  serviceId: string;
  service: ServiceKind;
  /** Nom affiché : celui choisi par l'élève, sinon celui du service (`subject`). */
  label: string;
  color: string;
  emoji: string;
}

async function loadCourses(
  accountId: string,
  from: Date,
  to: Date
): Promise<CourseView[]> {
  const rows = await db
    .select({
      course: courses,
      service: services.kind,
      displayName: subjects.displayName,
      color: subjects.color,
      emoji: subjects.emoji,
    })
    .from(courses)
    .innerJoin(services, eq(services.id, courses.serviceId))
    .leftJoin(
      subjects,
      and(
        eq(subjects.serviceId, courses.serviceId),
        eq(subjects.name, courses.subject)
      )
    )
    .where(
      and(
        eq(services.accountId, accountId),
        gte(courses.from, from),
        lt(courses.from, to)
      )
    )
    .orderBy(courses.from);
  return rows.map(({ course, service, ...chosen }) => ({
    id: course.id,
    subject: course.subject,
    from: course.from,
    to: course.to,
    room: course.room ?? undefined,
    teacher: course.teacher ?? undefined,
    group: course.group ?? undefined,
    status: course.status ?? undefined,
    serviceId: course.serviceId,
    service,
    ...subjectLook(course.subject, chosen),
  }));
}

const source = new Source<CourseView[]>("courses", "subjects");

/** Les cours de la semaine de `week`, du lundi au dimanche. */
export function useTimetable(accountId: string | undefined, week: Date) {
  return useWeekData(source, accountId, week, loadCourses);
}
