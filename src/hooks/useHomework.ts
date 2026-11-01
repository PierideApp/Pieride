// Les devoirs à rendre dans une semaine pour un compte, avec l'apparence de leur matière.
// La consigne est ramenée à du texte : PRONOTE l'envoie en HTML. Relus après chaque synchro.
import { and, eq, gte, lt } from "drizzle-orm";

import { db } from "@/database";
import { homework, services, subjects } from "@/database/schema";
import { htmlToText } from "@/lib/html";
import { subjectLook } from "@/lib/subjects";
import type { Homework } from "@/services/shared/models";

import { Source } from "./useQuery";
import { useWeekData } from "./useWeekData";

/** Un devoir tel que l'app l'affiche ; `content` est du texte. */
export interface HomeworkView extends Homework {
  serviceId: string;
  label: string;
  color: string;
  emoji: string;
}

export async function loadHomework(
  accountId: string,
  from: Date,
  to: Date
): Promise<HomeworkView[]> {
  const rows = await db
    .select({
      item: homework,
      displayName: subjects.displayName,
      color: subjects.color,
      emoji: subjects.emoji,
    })
    .from(homework)
    .innerJoin(services, eq(services.id, homework.serviceId))
    .leftJoin(
      subjects,
      and(
        eq(subjects.serviceId, homework.serviceId),
        eq(subjects.name, homework.subject)
      )
    )
    .where(
      and(
        eq(services.accountId, accountId),
        gte(homework.dueAt, from),
        lt(homework.dueAt, to)
      )
    )
    .orderBy(homework.dueAt);
  return rows.map(({ item, ...chosen }) => ({
    id: item.id,
    serviceId: item.serviceId,
    subject: item.subject,
    content: htmlToText(item.content),
    givenAt: item.givenAt ?? undefined,
    dueAt: item.dueAt,
    done: item.done,
    attachments: item.attachments,
    ...subjectLook(item.subject, chosen),
  }));
}

const source = new Source<HomeworkView[]>("homework", "subjects");

/** Les devoirs à rendre dans la semaine de `week`, du lundi au dimanche. */
export function useHomework(accountId: string | undefined, week: Date) {
  return useWeekData(source, accountId, week, loadHomework);
}
