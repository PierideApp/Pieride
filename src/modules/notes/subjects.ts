// Les matières d'une période pour Notes : leurs notes, leur moyenne (celle du service si elle
// existe, sinon calculée) et les moyennes de la classe. Tout est ramené sur 20. Une carte par
// `subjectId` : deux sous-services PRONOTE de même nom restent séparés, comme dans PRONOTE.
import type { GradeView, SubjectAverageView } from "@/hooks/useGrades";
import { subjectAverages } from "@/lib/grades";

export interface SubjectSummary {
  subjectId: string;
  label: string;
  color: string;
  emoji: string;
  grades: GradeView[];
  /** Moyenne de l'élève sur 20. */
  average?: number;
  /** Moyennes du service, sur 20. */
  service?: { classAverage?: number; min?: number; max?: number };
  /** Date de la dernière note. */
  last: number;
}

export function summarize(
  grades: readonly GradeView[],
  averages: readonly SubjectAverageView[]
): SubjectSummary[] {
  const computed = subjectAverages(grades, grade => grade.subjectId);
  const bySubject = new Map<string, GradeView[]>();
  for (const grade of grades) {
    bySubject.set(grade.subjectId, [
      ...(bySubject.get(grade.subjectId) ?? []),
      grade,
    ]);
  }
  return [...bySubject].map(([subjectId, own]) => {
    const first = own[0];
    const row = averages.find(average => average.subjectId === subjectId);
    const twenty = (value: number | undefined) =>
      value === undefined || !row || row.outOf <= 0
        ? undefined
        : (value / row.outOf) * 20;
    return {
      subjectId,
      label: first?.label ?? "",
      color: first?.color ?? "",
      emoji: first?.emoji ?? "",
      grades: [...own].sort((a, b) => b.date.getTime() - a.date.getTime()),
      average: twenty(row?.student) ?? computed.get(subjectId),
      service: row && {
        classAverage: twenty(row.classAverage),
        min: twenty(row.min),
        max: twenty(row.max),
      },
      last: Math.max(...own.map(grade => grade.date.getTime())),
    };
  });
}
