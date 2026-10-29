// Les comptes et leurs services, lus dans la base. Relus après chaque synchronisation.
import { db } from "@/database";
import { accounts, services } from "@/database/schema";
import type { Account, ServiceKind } from "@/services/shared/models";

import { useLoaded } from "./useLoaded";

export interface AccountService {
  id: string;
  kind: ServiceKind;
  /** Le service a refusé les identifiants : il faut se reconnecter. */
  needsLogin: boolean;
  /** Adresse propre au compte (instance PRONOTE…). */
  instanceUrl?: string;
}

export interface AccountSummary extends Account {
  kinds: ServiceKind[];
  services: AccountService[];
}

async function loadAccounts(): Promise<AccountSummary[]> {
  const [rows, linked] = await Promise.all([
    db.select().from(accounts).orderBy(accounts.createdAt),
    db
      .select({
        id: services.id,
        accountId: services.accountId,
        kind: services.kind,
        needsLogin: services.needsLogin,
        instanceUrl: services.instanceUrl,
      })
      .from(services)
      .orderBy(services.createdAt),
  ]);
  return rows.map(row => {
    const own = linked
      .filter(service => service.accountId === row.id)
      .map(({ id, kind, needsLogin, instanceUrl }) => ({
        id,
        kind,
        needsLogin,
        instanceUrl: instanceUrl ?? undefined,
      }));
    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      schoolName: row.schoolName ?? undefined,
      className: row.className ?? undefined,
      avatar: row.avatar ?? undefined,
      kinds: own.map(service => service.kind),
      services: own,
    };
  });
}

export const useAccounts = () => useLoaded(loadAccounts, "accounts");
