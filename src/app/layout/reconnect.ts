// Les services qui ont refusé leur jeton : leurs données ne se mettent plus à jour tant qu'on ne
// se reconnecte pas. Lus par le bandeau des pages et la notification du système.
import type { AccountService, AccountSummary } from "@/hooks/useAccounts";

export interface Refused {
  account: AccountSummary;
  service: AccountService;
}

/** Les services à reconnecter, ceux du compte affiché d'abord. */
export function refusedServices(
  accounts: readonly AccountSummary[],
  currentId: string | undefined
): Refused[] {
  return [...accounts]
    .sort((a, b) => Number(b.id === currentId) - Number(a.id === currentId))
    .flatMap(account =>
      account.services
        .filter(service => service.needsLogin)
        .map(service => ({ account, service }))
    );
}

/** La clé des textes (`reconnect.<raison>`) : jeton expiré, perdu en route ou compte fermé. */
export function reasonOf(
  service: AccountService
): "expired" | "lost" | "disabled" {
  return service.authFailure === "credential_lost"
    ? "lost"
    : service.authFailure === "account_disabled"
      ? "disabled"
      : "expired";
}

/**
 * Ceux qui viennent d'être refusés, absents de `known`. `known` à `null` : première lecture du
 * lancement, rien n'est nouveau (le bandeau suffit pour un refus d'un lancement précédent).
 */
export function newlyRefused(
  known: ReadonlySet<string> | null,
  refused: readonly Refused[]
): Refused[] {
  return known ? refused.filter(({ service }) => !known.has(service.id)) : [];
}
