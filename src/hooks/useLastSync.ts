import { and, eq, max } from "drizzle-orm";

import { db } from "@/database";
import { services, syncState } from "@/database/schema";
import type { SyncCounts } from "@/lib/syncStatus";
import type { SyncedCapability } from "@/services/account-manager";

import { Source, useQuery } from "./useQuery";

const accountSync = new Source<Date | null>("sync");
const serviceSync = new Source<Date | null>("sync");
const accountCounts = new Source<SyncCounts>("sync");

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

/**
 * Combien de données d'un compte ont réussi leur dernière synchro, et combien ont échoué
 * (`sync_state.last_error`) : de quoi dire « Synchronisé », « partielle » ou « échec ».
 */
export function useSyncCounts(accountId: string | undefined) {
  return useQuery(accountCounts, `${accountId}`, async () => {
    if (!accountId) {
      return { ok: 0, errors: 0 };
    }
    const rows = await db
      .select({ lastSync: syncState.lastSync, lastError: syncState.lastError })
      .from(syncState)
      .innerJoin(services, eq(syncState.serviceId, services.id))
      .where(eq(services.accountId, accountId));
    return {
      ok: rows.filter(row => row.lastSync && !row.lastError).length,
      errors: rows.filter(row => row.lastError).length,
    };
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
