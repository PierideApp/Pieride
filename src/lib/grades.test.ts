import { describe, expect, it } from "vitest";

import { average, type Graded, history, influence } from "./grades";

const grade = (
  subject: string,
  value: number | undefined,
  coefficient = 1,
  extra: Partial<Graded> = {}
): Graded => ({
  subject,
  date: new Date(2026, 9, 1),
  value,
  outOf: 20,
  coefficient,
  bonus: false,
  optional: false,
  ...extra,
});

describe("average", () => {
  const grades = [
    grade("Maths", 16, 2),
    grade("Maths", 10, 1),
    grade("Anglais", 8, 1),
    grade("Anglais", undefined, 1),
  ];

  it("pondère par les coefficients et ignore les notes sans points", () => {
    expect(average(grades, "weighted")).toBeCloseTo(12.5);
  });

  it("fait la moyenne des moyennes de matières", () => {
    // Maths 14, Anglais 8.
    expect(average(grades, "subjects")).toBeCloseTo(11);
  });

  it("prend la médiane des notes", () => {
    expect(average(grades, "median")).toBe(10);
  });

  it("ramène une note sur 20 et ne garde une facultative que si elle aide", () => {
    expect(
      average(
        [
          grade("Maths", 5, 1, { outOf: 10 }),
          grade("Maths", 4, 1, { optional: true }),
          grade("Maths", 18, 1, { optional: true }),
        ],
        "weighted"
      )
    ).toBeCloseTo(14);
  });
});

describe("history", () => {
  it("donne la moyenne après chaque jour de notes", () => {
    const first = grade("Maths", 10);
    const second = { ...grade("Maths", 16), date: new Date(2026, 9, 5, 14) };
    expect(
      history([second, first], "weighted").map(point => point.value)
    ).toEqual([10, 13]);
  });
});

describe("influence", () => {
  it("mesure ce que la note change à la moyenne", () => {
    const good = grade("Maths", 18);
    expect(influence([grade("Maths", 10), good], good, "weighted")).toBeCloseTo(
      4
    );
  });
});
