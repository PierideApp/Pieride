// Les actualités d'un compte, de la plus récente à la plus ancienne. Le contenu est ramené à
// du texte : les services l'envoient en HTML. Relues après chaque synchronisation.
import { desc, eq } from "drizzle-orm";

import { db } from "@/database";
import { news, services } from "@/database/schema";
import { newsContentToHtml, newsContentToText } from "@/lib/html";
import type { News, ServiceKind } from "@/services/shared/models";

import { Source, useQuery } from "./useQuery";

/** Une actualité telle que l'app l'affiche ; `content` est du texte. */
export interface NewsView extends News {
  serviceId: string;
  service: ServiceKind;
  /** HTML source décodée, rendue par l'écran après filtrage strict des balises et URLs. */
  htmlContent: string;
}

export async function loadNews(accountId: string): Promise<NewsView[]> {
  const rows = await db
    .select({ item: news, service: services.kind })
    .from(news)
    .innerJoin(services, eq(services.id, news.serviceId))
    .where(eq(services.accountId, accountId))
    .orderBy(desc(news.date));
  return rows.map(({ item, service }) => ({
    ...item,
    title: item.title ?? undefined,
    category: item.category ?? undefined,
    // Décode aussi les anciennes lignes enregistrées avant le correctif Base64.
    content: newsContentToText(item.content),
    htmlContent: newsContentToHtml(item.content),

    service,
  }));
}

const source = new Source<NewsView[]>("news");

export function useNews(accountId: string | undefined) {
  return useQuery(source, `${accountId}`, () =>
    accountId ? loadNews(accountId) : Promise.resolve([])
  );
}
