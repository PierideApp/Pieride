import { and, eq, max } from "drizzle-orm";

import { db } from "@/database";
import { services, syncState } from "@/database/schema";
import type { SyncedCapability } from "@/services/account-manager";

import { Source, useQuery } from "./useQuery";

const accountSync = new Source<Date | null>("sync");
const serviceSync = new Source<Date | null>("sync");

/** Date de la dernière synchro réussie d'un compte, tous services confondus. */
export function useLastSync(accountId: string | undefined) {
  return useQuery(accountSync, `${accountId}`, async () => {
    if (!accountId) {
      return null;
    }
    const [row] = await db
      .select({ lastSync: max(syncState.lastSync) })
      .from(syncState)
      .innerJoin(services, eq(syncState.serviceId, services.id))
      .where(eq(services.accountId, accountId));
    return row?.lastSync ?? null;
  });
}

/** Date de la dernière synchro réussie d'une donnée d'un service (« Mis à jour à 10:40 »). */
export function useServiceSync(
  serviceId: string,
  capability: SyncedCapability
) {
  return useQuery(serviceSync, `${serviceId}:${capability}`, async () => {
    const [row] = await db
      .select({ lastSync: syncState.lastSync })
      .from(syncState)
      .where(
        and(
          eq(syncState.serviceId, serviceId),
          eq(syncState.capability, capability)
        )
      );
    return row?.lastSync ?? null;
  });
}
