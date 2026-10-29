import { describe, expect, it } from "vitest";

import { weekStart } from "../account-manager";
import { mockPlugin } from ".";

// Lundi 26 octobre 2026 : premier trimestre de l'année 2026-2027.
const NOW = new Date(2026, 9, 26, 10);
const { TIMETABLE, HOMEWORK, GRADES } = mockPlugin(() => NOW).capabilities;

describe("données fictives", () => {
  it("remplit la semaine demandée, avec des identifiants propres à chaque semaine", async () => {
    const monday = weekStart(NOW);
    const nextMonday = new Date(2026, 10, 2);
    const week = await TIMETABLE?.getWeeklyTimetable(monday);
    const next = await TIMETABLE?.getWeeklyTimetable(nextMonday);
    const homework = await HOMEWORK?.getHomeworks(monday);

    expect(week?.length).toBeGreaterThan(0);
    for (const item of [...(week ?? []), ...(homework ?? [])]) {
      const date = "from" in item ? item.from : item.dueAt;
      expect(date >= monday && date < nextMonday).toBe(true);
    }
    const ids = week?.map(course => course.id) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
    expect(next?.some(course => ids.includes(course.id))).toBe(false);
  });

  it("ne donne que les notes déjà passées, dans leur trimestre", async () => {
    const periods = (await GRADES?.getGradesPeriods()) ?? [];
    expect(periods.map(period => period.name)).toEqual([
      "Trimestre 1",
      "Trimestre 2",
      "Trimestre 3",
    ]);
    expect(periods[0]?.start).toEqual(new Date(2026, 8, 1));

    const [first, second] = periods;
    const now = first && (await GRADES?.getGradesForPeriod(first))?.grades;
    const later = second && (await GRADES?.getGradesForPeriod(second))?.grades;
    expect(now?.length).toBeGreaterThan(0);
    expect(now?.every(grade => grade.date <= NOW)).toBe(true);
    expect(later).toEqual([]);
  });

  it("garde un devoir coché pour la session", async () => {
    const [first] = (await HOMEWORK?.getHomeworks(weekStart(NOW))) ?? [];
    await HOMEWORK?.setHomeworkCompletion(first?.id ?? "", !first?.done);
    const [again] = (await HOMEWORK?.getHomeworks(weekStart(NOW))) ?? [];
    expect(again?.done).toBe(!first?.done);
  });
});
