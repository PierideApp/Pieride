import { describe, expect, it } from "vitest";

import { getLog, log, logRequest, logText, redact } from "./log";

describe("redact", () => {
  it("masque les identifiants et les paramètres d'URL", () => {
    expect(
      redact(
        "échec https://eleve:secret@pronote.fr/eleve.html?login=true&jeton=abc"
      )
    ).toBe("échec https://***@pronote.fr/eleve.html?***");
  });

  it("masque les longues suites qui ressemblent à un jeton", () => {
    expect(redact("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 refusé")).toBe(
      "Bearer *** refusé"
    );
    expect(redact("Synchronisation terminée (6 cours)")).toBe(
      "Synchronisation terminée (6 cours)"
    );
  });
});

describe("log", () => {
  it("garde les messages masqués et compte les requêtes", () => {
    log("error", "sync", "Jeton refusé : 0123456789abcdef0123456789abcdef");
    logRequest({
      method: "GET",
      host: "pronote.fr",
      status: 200,
      duration: 12,
    });
    expect(getLog().requestCount).toBe(1);
    expect(logText()).toMatch(/ERROR sync Jeton refusé : \*\*\*$/);
  });
});
