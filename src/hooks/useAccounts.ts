// Les comptes et leurs services, lus dans la base. Relus après chaque synchronisation.
import { db } from "@/database";
import { accounts, services } from "@/database/schema";
import type { AuthFailure } from "@/services/shared/auth";
import type { Account, ServiceKind } from "@/services/shared/models";

import { Source, useQuery } from "./useQuery";

export interface AccountService {
  id: string;
  kind: ServiceKind;
  /** Le service a refusé les identifiants : il faut se reconnecter. */
  needsLogin: boolean;
  /** Pourquoi la dernière connexion a échoué (`credential_lost` : coupée en plein renouvellement). */
  authFailure: AuthFailure | null;
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
        authFailure: services.authFailure,
        instanceUrl: services.instanceUrl,
      })
      .from(services)
      .orderBy(services.createdAt),
  ]);
  return rows.map(row => {
    const own = linked
      .filter(service => service.accountId === row.id)
      .map(({ id, kind, needsLogin, authFailure, instanceUrl }) => ({
        id,
        kind,
        needsLogin,
        authFailure,
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

const source = new Source<AccountSummary[]>("accounts");

export const useAccounts = () => useQuery(source, "", loadAccounts);
