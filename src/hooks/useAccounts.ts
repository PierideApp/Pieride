// Les comptes et leurs services, lus dans la base. Relus après chaque synchronisation.
import { db } from "@/database";
import { accounts, services } from "@/database/schema";
import type { Account, ServiceKind } from "@/services/shared/models";

import { useLoaded } from "./useLoaded";

export interface AccountSummary extends Account {
  kinds: ServiceKind[];
}

async function loadAccounts(): Promise<AccountSummary[]> {
  const [rows, linked] = await Promise.all([
    db.select().from(accounts).orderBy(accounts.createdAt),
    db
      .select({ accountId: services.accountId, kind: services.kind })
      .from(services),
  ]);
  return rows.map(row => ({
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    schoolName: row.schoolName ?? undefined,
    className: row.className ?? undefined,
    kinds: linked
      .filter(service => service.accountId === row.id)
      .map(service => service.kind),
  }));
}

export const useAccounts = () => useLoaded(loadAccounts, "accounts");
