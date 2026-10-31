// Les matières d'une période pour Notes : leurs notes, leur moyenne (celle du service si elle
// existe, sinon calculée) et les moyennes de la classe. Tout est ramené sur 20.
import type { GradeView, SubjectAverageView } from "@/hooks/useGrades";
import { subjectAverages } from "@/lib/grades";

export interface SubjectSummary {
  subject: string;
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
  const computed = subjectAverages(grades);
  const bySubject = new Map<string, GradeView[]>();
  for (const grade of grades) {
    bySubject.set(grade.subject, [
      ...(bySubject.get(grade.subject) ?? []),
      grade,
    ]);
  }
  return [...bySubject].map(([subject, own]) => {
    const first = own[0];
    const row = averages.find(average => average.subject === subject);
    const twenty = (value: number | undefined) =>
      value === undefined || !row || row.outOf <= 0
        ? undefined
        : (value / row.outOf) * 20;
    return {
      subject,
      label: first?.label ?? subject,
      color: first?.color ?? "",
      emoji: first?.emoji ?? "",
      grades: [...own].sort((a, b) => b.date.getTime() - a.date.getTime()),
      average: twenty(row?.student) ?? computed.get(subject),
      service: row && {
        classAverage: twenty(row.classAverage),
        min: twenty(row.min),
        max: twenty(row.max),
      },
      last: Math.max(...own.map(grade => grade.date.getTime())),
    };
  });
}
