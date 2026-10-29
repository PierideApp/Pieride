import { describe, expect, it } from "vitest";

import type { SchoolServicePlugin } from "./plugin";

// Ces vérifications sont faites par `pnpm typecheck` : si une ligne `@ts-expect-error`
// compile, TypeScript signale une erreur.
describe("SchoolServicePlugin", () => {
  it("n'accepte une capability qu'avec toutes ses méthodes", () => {
    const complete: SchoolServicePlugin = {
      kind: "pronote",
      capabilities: {
        GRADES: {
          getGradesPeriods: async () => [],
          getGradesForPeriod: async () => ({ grades: [], subjects: [] }),
        },
      },
    };

    const incomplete: SchoolServicePlugin = {
      kind: "pronote",
      capabilities: {
        // @ts-expect-error getGradesForPeriod manque : GRADES ne peut pas être déclarée
        GRADES: { getGradesPeriods: async () => [] },
      },
    };

    const unknown: SchoolServicePlugin = {
      kind: "pronote",
      // @ts-expect-error CHAT_READ n'est pas une capability reprise
      capabilities: { CHAT_READ: {} },
    };

    expect(complete.capabilities.GRADES).toBeDefined();
    expect([incomplete, unknown]).toHaveLength(2);
  });
});
