import { describe, expect, it } from "vitest";

import type { AccountService, AccountSummary } from "@/hooks/useAccounts";

import { newlyRefused, reasonOf, refusedServices } from "./reconnect";

const service = (
  id: string,
  patch: Partial<AccountService> = {}
): AccountService => ({
  id,
  kind: "pronote",
  needsLogin: false,
  authFailure: null,
  ...patch,
});

const account = (id: string, services: AccountService[]): AccountSummary => ({
  id,
  firstName: id,
  lastName: "Martin",
  kinds: services.map(({ kind }) => kind),
  services,
});

const camille = account("camille", [
  service("a", { needsLogin: true, authFailure: "credential_rejected" }),
]);
const lou = account("lou", [
  service("b"),
  service("c", { needsLogin: true, authFailure: "credential_lost" }),
]);

describe("refusedServices", () => {
  it("met le compte affiché devant les autres", () => {
    const ids = (current: string) =>
      refusedServices([camille, lou], current).map(({ service }) => service.id);
    expect(ids("lou")).toEqual(["c", "a"]);
    expect(ids("camille")).toEqual(["a", "c"]);
  });
});

describe("reasonOf", () => {
  it("distingue un jeton expiré, perdu ou un compte fermé", () => {
    expect(reasonOf(camille.services[0])).toBe("expired");
    expect(reasonOf(lou.services[1])).toBe("lost");
    expect(
      reasonOf(
        service("d", { needsLogin: true, authFailure: "account_disabled" })
      )
    ).toBe("disabled");
  });
});

describe("newlyRefused", () => {
  const refused = refusedServices([camille, lou], undefined);

  it("n'annonce rien à la première lecture du lancement", () => {
    expect(newlyRefused(null, refused)).toEqual([]);
  });

  it("annonce seulement les refus apparus depuis la lecture d'avant", () => {
    expect(
      newlyRefused(new Set(["a"]), refused).map(({ service }) => service.id)
    ).toEqual(["c"]);
  });
});
