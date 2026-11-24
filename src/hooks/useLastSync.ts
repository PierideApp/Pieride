import { and, count, eq, inArray, max } from "drizzle-orm";

import { db } from "@/database";
import { services, syncState } from "@/database/schema";
import type { SyncedCapability } from "@/services/account-manager";
import type { Capability } from "@/services/shared/plugin";

import { Source, useQuery } from "./useQuery";

export interface AccountSync {
  /** La dernière synchro réussie, tous services confondus. */
  last: Date | null;
  /** Les données dont la dernière synchro a échoué (`sync_state.last_error`). */
  failures: "none" | "some" | "all";
}

const accountSync = new Source<AccountSync>("sync");
const serviceSync = new Source<Date | null>("sync");

/**
 * L'état de synchro d'un compte (barre latérale) : « Synchronisé », « en partie » ou « échec ».
 * Seules comptent `capabilities`, les données des modules affichés : l'erreur d'un module
 * masqué ne reste pas affichée.
 */
export function useAccountSync(
  accountId: string | undefined,
  capabilities: readonly Capability[]
) {
  const key = `${accountId}:${capabilities.join()}`;
  return useQuery(accountSync, key, async () => {
    if (!accountId) {
      return { last: null, failures: "none" };
    }
    const [row] = await db
      .select({
        last: max(syncState.lastSync),
        failed: count(syncState.lastError),
        total: count(),
      })
      .from(syncState)
      .innerJoin(services, eq(syncState.serviceId, services.id))
      .where(
        and(
          eq(services.accountId, accountId),
          inArray(syncState.capability, [...capabilities])
        )
      );
    const { last = null, failed = 0, total = 0 } = row ?? {};
    return {
      last,
      failures: failed === 0 ? "none" : failed < total ? "some" : "all",
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
