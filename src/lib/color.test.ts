import { describe, expect, it } from "vitest";

import { accentShades, mix } from "./color";

describe("mix", () => {
  it("rend chaque couleur à ses extrémités", () => {
    expect(mix("#e8b048", "#ffffff", 1)).toBe("#e8b048");
    expect(mix("#e8b048", "#181733", 0)).toBe("#181733");
  });

  it("mélange en Oklab, comme color-mix(in oklab)", () => {
    // Le gris du milieu d'Oklab, plus clair que le #808080 d'un mélange en sRGB.
    expect(mix("#ffffff", "#000000", 0.5)).toBe("#636363");
    expect(mix("#2b2bc2", "#ffffff", 0.75)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("rend la couleur telle quelle si elle n'est pas en #rrggbb", () => {
    expect(mix("var(--x)", "#ffffff", 0.5)).toBe("var(--x)");
  });
});

describe("accentShades", () => {
  it("garde la couleur en clair et l'éclaircit en sombre", () => {
    expect(accentShades("#dd0030", false, "#ffffff")).toMatchObject({
      accent: "#dd0030",
      text: "#dd0030",
    });
    const dark = accentShades("#dd0030", true, "#181733");
    expect(dark.accent).not.toBe("#dd0030");
    expect(dark.soft).not.toBe("#181733");
  });
});
