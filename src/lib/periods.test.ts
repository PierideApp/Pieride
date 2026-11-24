import { describe, expect, it } from "vitest";

import type { Period } from "@/services/shared/models";

import { periodToOpen } from "./periods";

const period = (name: string, start: Date, end: Date): Period => ({
  id: name,
  name,
  start,
  end,
});

// Dans l'ordre de la base, par début : « Hors période » recouvre toute l'année.
const OUTSIDE = period(
  "Hors période",
  new Date(2026, 7, 24),
  new Date(2027, 7, 31)
);
const YEAR = period("Année", new Date(2026, 8, 1), new Date(2027, 6, 4));
const FIRST = period(
  "Trimestre 1",
  new Date(2026, 8, 1),
  new Date(2026, 10, 30)
);
const SECOND = period(
  "Trimestre 2",
  new Date(2026, 11, 1),
  new Date(2027, 2, 7)
);
const THIRD = period("Trimestre 3", new Date(2027, 2, 8), new Date(2027, 6, 4));
const PERIODS = [OUTSIDE, YEAR, FIRST, SECOND, THIRD];

const DECEMBER = new Date(2026, 11, 10);
const none = () => false;

describe("periodToOpen", () => {
  it("ouvre la période que le service ouvre lui-même", () => {
    const periods = PERIODS.map(item => ({
      ...item,
      isDefault: item === FIRST,
    }));
    expect(periodToOpen(periods, DECEMBER, none)?.name).toBe("Trimestre 1");
  });

  it("sans elle, prend le trimestre en cours plutôt que « Hors période » ou l'année", () => {
    const periods = PERIODS.map(item => ({ ...item, isDefault: false }));
    expect(periodToOpen(periods, DECEMBER, none)?.name).toBe("Trimestre 2");
    expect(periodToOpen(PERIODS, DECEMBER, none)?.name).toBe("Trimestre 2");
  });

  it("rien en cours, prend la dernière qui a des données", () => {
    expect(
      periodToOpen(
        [YEAR, FIRST, SECOND, THIRD],
        new Date(2027, 6, 20),
        item => item !== THIRD
      )?.name
    ).toBe("Trimestre 2");
  });
});
