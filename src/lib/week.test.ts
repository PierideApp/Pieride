import { describe, expect, it } from "vitest";

import {
  addDays,
  displayedToday,
  isoWeek,
  sameDay,
  shiftDay,
  weekDays,
  weekStart,
} from "./week";

describe("weekStart", () => {
  it("renvoie le lundi 0 h, même un dimanche ou un jour de changement d'heure", () => {
    expect(weekStart(new Date(2026, 10, 1, 23))).toEqual(new Date(2026, 9, 26));
    expect(weekStart(new Date(2026, 9, 25, 12))).toEqual(new Date(2026, 9, 19));
    expect(weekStart(new Date(2026, 9, 26))).toEqual(new Date(2026, 9, 26));
  });
});

describe("addDays", () => {
  it("garde l'heure locale à travers le changement d'heure", () => {
    // Passage à l'heure d'hiver dans la nuit du 24 au 25 octobre 2026.
    expect(addDays(new Date(2026, 9, 24, 8), 1)).toEqual(
      new Date(2026, 9, 25, 8)
    );
    expect(addDays(new Date(2026, 9, 26), -7)).toEqual(new Date(2026, 9, 19));
  });
});

describe("isoWeek", () => {
  it("numérote les semaines comme le calendrier scolaire", () => {
    expect(isoWeek(new Date(2026, 9, 15))).toBe(42);
    expect(isoWeek(new Date(2026, 9, 25, 23))).toBe(43);
    expect(isoWeek(new Date(2026, 9, 26))).toBe(44);
  });

  it("rattache les jours de janvier ou de décembre à la bonne année", () => {
    // Le 1er janvier 2027 est un vendredi : il appartient à la semaine 53 de 2026.
    expect(isoWeek(new Date(2027, 0, 1))).toBe(53);
    expect(isoWeek(new Date(2027, 0, 4))).toBe(1);
    // Le 31 décembre 2025 est un mercredi : semaine 1 de 2026.
    expect(isoWeek(new Date(2025, 11, 31))).toBe(1);
  });
});

describe("weekDays", () => {
  it("donne cinq jours, ou sept avec le week-end", () => {
    const days = weekDays(new Date(2026, 9, 15, 10), false);
    expect(days).toHaveLength(5);
    expect(days[0]).toEqual(new Date(2026, 9, 12));
    expect(days[4]).toEqual(new Date(2026, 9, 16));
    expect(weekDays(new Date(2026, 9, 15), true)[6]).toEqual(
      new Date(2026, 9, 18)
    );
  });
});

describe("sameDay", () => {
  it("compare le jour, pas l'heure", () => {
    expect(sameDay(new Date(2026, 9, 15, 8), new Date(2026, 9, 15, 23))).toBe(
      true
    );
    expect(sameDay(new Date(2026, 9, 15), new Date(2026, 9, 16))).toBe(false);
  });
});

describe("shiftDay", () => {
  it("saute le week-end masqué, dans les deux sens", () => {
    const friday = new Date(2026, 9, 16);
    const monday = new Date(2026, 9, 19);
    expect(shiftDay(friday, 1, false)).toEqual(monday);
    expect(shiftDay(monday, -1, false)).toEqual(friday);
    expect(shiftDay(friday, 1, true)).toEqual(new Date(2026, 9, 17));
  });
});

describe("displayedToday", () => {
  it("ouvre le lundi suivant un dimanche si le week-end est masqué", () => {
    const sunday = new Date(2026, 9, 18, 20);
    expect(displayedToday(sunday, false)).toEqual(new Date(2026, 9, 19));
    expect(displayedToday(sunday, true)).toEqual(new Date(2026, 9, 18));
    expect(displayedToday(new Date(2026, 9, 15, 10), false)).toEqual(
      new Date(2026, 9, 15)
    );
  });
});
