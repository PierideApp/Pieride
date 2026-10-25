import { describe, expect, it } from "vitest";

import en from "./en.json";
import fr from "./fr.json";

function keys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) {
    return [prefix];
  }
  return Object.entries(value)
    .flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key))
    .sort();
}

describe("locales", () => {
  it("en a exactement les clés de fr", () => {
    expect(keys(en)).toEqual(keys(fr));
  });
});
