import { describe, expect, it } from "vitest";

import type { GradeView, SubjectAverageView } from "@/hooks/useGrades";

import { summarize } from "./subjects";

const SUBJECT = "ENSEIGN.SCIENTIFIQUE > ENSEIGN.SCIENTIFIQUE";

const grade = (id: string, subjectId: string, value: number): GradeView => ({
  serviceId: "s1",
  id,
  subject: SUBJECT,
  subjectId,
  label: SUBJECT,
  color: "#123456",
  emoji: "🧪",
  periodId: "t1",
  title: id,
  date: new Date(2026, 10, 10),
  value,
  outOf: 20,
  coefficient: 1,
  bonus: false,
  optional: false,
});

const average = (subjectId: string, student: number): SubjectAverageView => ({
  serviceId: "s1",
  periodId: "t1",
  subject: SUBJECT,
  subjectId,
  student,
  classAverage: 12,
  outOf: 20,
});

describe("summarize", () => {
  it("garde séparés deux sous-services de même nom, chacun avec sa moyenne", () => {
    const summaries = summarize(
      [grade("qcm", "es-1", 18), grade("ds", "es-2", 19.5)],
      [average("es-1", 17.38), average("es-2", 19.5)]
    );
    expect(
      summaries.map(summary => [
        summary.subjectId,
        summary.grades.map(item => item.id),
        summary.average,
      ])
    ).toEqual([
      ["es-1", ["qcm"], 17.38],
      ["es-2", ["ds"], 19.5],
    ]);
  });

  it("calcule la moyenne d'un sous-service dont le service ne donne rien", () => {
    const [summary] = summarize(
      [grade("qcm", "es-1", 18), grade("ds", "es-2", 10)],
      []
    );
    expect(summary?.average).toBe(18);
  });
});
