import { describe, expect, it } from "vitest";

import { parseEcoledirecteSecret } from "./session";

describe("parseEcoledirecteSecret", () => {
  it("lit un secret valide conservé dans le trousseau", () => {
    expect(
      parseEcoledirecteSecret(
        JSON.stringify({
          username: "eleve",
          accessToken: "token-test",
          accountId: 123,
          accountKind: "E",
          deviceUUID: "device-test",
        })
      )
    ).toEqual({
      username: "eleve",
      accessToken: "token-test",
      accountId: 123,
      accountKind: "E",
      deviceUUID: "device-test",
    });
  });

  it("refuse une structure de secret invalide", () => {
    expect(
      parseEcoledirecteSecret(
        JSON.stringify({
          username: "eleve",
          accessToken: "token-test",
          accountId: "123",
          accountKind: "unknown",
          deviceUUID: "device-test",
        })
      )
    ).toBeNull();
    expect(parseEcoledirecteSecret("{")).toBeNull();
  });
});
