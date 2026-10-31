import { describe, expect, it } from "vitest";

import { matches } from "./search";

describe("matches", () => {
  it("trouve chaque mot, sans accents ni majuscules, dans n'importe quel ordre", () => {
    expect(matches("LYCÉE VICTOR HUGO", "hugo lycee")).toBe(true);
    expect(matches("Collège Émile Zola", "EMILE")).toBe(true);
  });

  it("refuse si un mot manque, garde tout pour une recherche vide", () => {
    expect(matches("LYCÉE VICTOR HUGO", "hugo zola")).toBe(false);
    expect(matches("LYCÉE VICTOR HUGO", "  ")).toBe(true);
  });
});
