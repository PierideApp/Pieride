import { eq, max } from "drizzle-orm";

import { db } from "@/database";
import { services, syncState } from "@/database/schema";

import { useLoaded } from "./useLoaded";

/** Date de la dernière synchro réussie d'un compte, tous services confondus. */
export function useLastSync(accountId: string | undefined) {
  return useLoaded(async () => {
    if (!accountId) {
      return null;
    }
    const [row] = await db
      .select({ lastSync: max(syncState.lastSync) })
      .from(syncState)
      .innerJoin(services, eq(syncState.serviceId, services.id))
      .where(eq(services.accountId, accountId));
    return row?.lastSync ?? null;
  }, `last-sync:${accountId}`);
}
