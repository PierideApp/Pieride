import { describe, expect, it } from "vitest";

import { hourRange, placeDay, withBreaks } from "./timetable";

const at = (hour: number, minute = 0) => new Date(2026, 9, 15, hour, minute);
const course = (id: string, from: Date, to: Date) => ({ id, from, to });

describe("hourRange", () => {
  it("garde 8 h à 17 h, élargi aux cours qui dépassent", () => {
    expect(hourRange([])).toEqual({ first: 8, last: 17 });
    expect(
      hourRange([
        course("a", at(7, 30), at(9)),
        course("b", at(17), at(18, 15)),
      ])
    ).toEqual({
      first: 7,
      last: 19,
    });
  });
});

describe("placeDay", () => {
  it("met côte à côte les cours qui se chevauchent, et eux seuls", () => {
    const placed = placeDay([
      course("maths", at(8), at(10)),
      course("anglais", at(9), at(10)),
      course("ses", at(10), at(11)),
    ]);
    const byId = Object.fromEntries(placed.map(p => [p.item.id, p]));
    expect(byId.maths).toMatchObject({
      start: 480,
      end: 600,
      column: 0,
      columns: 2,
    });
    expect(byId.anglais).toMatchObject({ column: 1, columns: 2 });
    expect(byId.ses).toMatchObject({ start: 600, column: 0, columns: 1 });
  });

  it("réutilise une colonne libérée dans un même groupe", () => {
    const placed = placeDay([
      course("long", at(8), at(11)),
      course("premier", at(8), at(9)),
      course("second", at(9), at(10)),
    ]);
    const byId = Object.fromEntries(placed.map(p => [p.item.id, p]));
    expect(byId.second).toMatchObject({ column: 1, columns: 2 });
  });

  it("donne au moins un quart d'heure à un cours de durée nulle", () => {
    const [placed] = placeDay([course("vide", at(8), at(8))]);
    expect(placed?.end).toBe(495);
  });
});

describe("withBreaks", () => {
  it("ajoute la récréation et la pause méridienne, pas un simple changement de salle", () => {
    const entries = withBreaks([
      course("maths", at(10, 15), at(11, 15)),
      course("français", at(8), at(10)),
      course("physique", at(11, 20), at(12, 15)),
      course("ses", at(13, 30), at(14, 30)),
    ]);
    expect(
      entries.map(entry =>
        entry.kind === "course"
          ? entry.item.id
          : `pause${entry.lunch ? " midi" : ""}`
      )
    ).toEqual(["français", "pause", "maths", "physique", "pause midi", "ses"]);
  });
});
