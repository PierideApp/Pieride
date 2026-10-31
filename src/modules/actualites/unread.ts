// Pastille d'Actualités dans la barre latérale : les actualités pas encore lues.
import { and, count, eq } from "drizzle-orm";

import { db } from "@/database";
import { news, services } from "@/database/schema";

export async function countUnreadNews(accountId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(news)
    .innerJoin(services, eq(services.id, news.serviceId))
    .where(and(eq(services.accountId, accountId), eq(news.read, false)));
  return row?.total ?? 0;
}
