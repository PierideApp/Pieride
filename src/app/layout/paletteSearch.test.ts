import { describe, expect, it } from "vitest";

import type { GradeView } from "@/hooks/useGrades";
import type { HomeworkView } from "@/hooks/useHomework";
import { EMPTY_INDEX, type SearchIndex } from "@/hooks/useSearchIndex";
import type { CourseView } from "@/hooks/useTimetable";

import { PER_MODULE, searchIndex } from "./paletteSearch";

const now = new Date(2026, 9, 15, 10);
const day = (offset: number) => new Date(2026, 9, 15 + offset, 8);
const look = { serviceId: "s1", color: "#123456", emoji: "📐" };

const task = (id: string, content: string, dueAt: Date): HomeworkView => ({
  ...look,
  id,
  subject: "MATHEMATIQUES",
  label: "Mathématiques",
  content,
  dueAt,
  done: false,
  attachments: [],
});

const grade = (id: string, title: string, date: Date): GradeView => ({
  ...look,
  id,
  subject: "MATHEMATIQUES",
  label: "Mathématiques",
  periodId: "T1",
  title,
  date,
  value: 16,
  outOf: 20,
  coefficient: 1,
  bonus: false,
  optional: false,
});

const course = (id: string, extra: Partial<CourseView>): CourseView => ({
  ...look,
  id,
  service: "pronote",
  subject: "PHYSIQUE-CHIMIE",
  label: "Physique-Chimie",
  from: day(0),
  to: day(0),
  ...extra,
});

const index = (part: Partial<SearchIndex>): SearchIndex => ({
  ...EMPTY_INDEX,
  ...part,
});
const ids = (items: readonly { id: string }[]) => items.map(item => item.id);

describe("searchIndex", () => {
  it("attend deux lettres avant de chercher", () => {
    const data = index({ homework: [task("a", "Exercice 3", day(1))] });
    expect(searchIndex(data, " e ", now)).toEqual(EMPTY_INDEX);
    expect(ids(searchIndex(data, "ex", now).homework)).toEqual(["a"]);
  });

  it("cherche la matière et la consigne, sans accents", () => {
    const data = index({
      homework: [
        task("a", "Exercices page 112", day(1)),
        task("b", "Rédaction", day(1)),
      ],
    });
    expect(ids(searchIndex(data, "mathematiques page", now).homework)).toEqual([
      "a",
    ]);
    expect(ids(searchIndex(data, "redac", now).homework)).toEqual(["b"]);
  });

  it("range les tâches au plus près d'aujourd'hui et en garde cinq", () => {
    const offsets = [-20, 9, -1, 3, 30, 1, -6];
    const data = index({
      homework: offsets.map(offset =>
        task(String(offset), "Exercice", day(offset))
      ),
    });
    const found = searchIndex(data, "exercice", now).homework;
    expect(found).toHaveLength(PER_MODULE);
    expect(ids(found)).toEqual(["1", "-1", "3", "-6", "9"]);
  });

  it("range les notes de la plus récente à la plus ancienne", () => {
    const data = index({
      grades: [
        grade("old", "Contrôle : suites", day(-30)),
        grade("new", "Contrôle : fonctions", day(-2)),
      ],
    });
    expect(ids(searchIndex(data, "controle", now).grades)).toEqual([
      "new",
      "old",
    ]);
  });

  it("cherche un cours par professeur, salle ou cahier de textes", () => {
    const data = index({
      courses: [
        course("prof", { teacher: "M. Garnier" }),
        course("salle", { room: "Labo 2" }),
        course("cahier", {
          contents: [
            { title: "Optique", description: "Lentilles", attachments: [] },
          ],
        }),
      ],
    });
    expect(ids(searchIndex(data, "garnier", now).courses)).toEqual(["prof"]);
    expect(ids(searchIndex(data, "labo", now).courses)).toEqual(["salle"]);
    expect(ids(searchIndex(data, "lentilles", now).courses)).toEqual([
      "cahier",
    ]);
  });
});
