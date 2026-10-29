// Pastille de Tâches dans la barre latérale : ce qui reste à faire, de la base locale.
import { and, count, eq, gte } from "drizzle-orm";

import { db } from "@/database";
import type { Db } from "@/database/client";
import { homework, services } from "@/database/schema";

/** Les tâches pas encore faites d'un compte, à rendre aujourd'hui ou plus tard. */
export async function countPendingHomework(
  accountId: string,
  now = new Date(),
  database: Db = db
): Promise<number> {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const [row] = await database
    .select({ total: count() })
    .from(homework)
    .innerJoin(services, eq(services.id, homework.serviceId))
    .where(
      and(
        eq(services.accountId, accountId),
        eq(homework.done, false),
        gte(homework.dueAt, today)
      )
    );
  return row?.total ?? 0;
}
