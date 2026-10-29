// Coup d'œil de la barre des tâches (UX §7) : le cours en cours et le suivant, aujourd'hui,
// pour le compte affiché. Les cours annulés ne comptent pas.
import { and, eq, gt, isNull, lt, ne, or, sql } from "drizzle-orm";

import { db } from "@/database";
import type { Db } from "@/database/client";
import { courses, services, subjects } from "@/database/schema";

export interface GlanceCourse {
  /** Nom affiché (Paramètres > Matières), sinon celui du service. */
  subject: string;
  from: Date;
  to: Date;
  room: string | null;
}

export async function glanceCourses(
  accountId: string,
  now = new Date(),
  database: Db = db
): Promise<{ current?: GlanceCourse; next?: GlanceCourse }> {
  const endOfDay = new Date(now);
  endOfDay.setHours(24, 0, 0, 0);
  const rows = await database
    .select({
      subject: sql<string>`coalesce(${subjects.displayName}, ${courses.subject})`,
      from: courses.from,
      to: courses.to,
      room: courses.room,
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
        gt(courses.to, now),
        lt(courses.from, endOfDay),
        or(isNull(courses.status), ne(courses.status, "canceled"))
      )
    )
    .orderBy(courses.from)
    .limit(3);
  return {
    current: rows.find(row => row.from <= now),
    next: rows.find(row => row.from > now),
  };
}
