// Moyennes calculées par l'app (Notes) : sur 20, avec les trois méthodes de la maquette
// 05-notes/05-methode-de-calcul. Une note sans points (absent, dispensé) ne compte pas ; une
// note facultative ou bonus ne compte que si elle fait monter la moyenne, comme dans PRONOTE.

export interface Graded {
  subject: string;
  date: Date;
  value?: number;
  outOf: number;
  coefficient: number;
  bonus: boolean;
  optional: boolean;
}

export const AVERAGE_METHODS = ["weighted", "subjects", "median"] as const;
export type AverageMethod = (typeof AVERAGE_METHODS)[number];

/** La note ramenée sur 20, ou `undefined` si elle n'a pas de points. */
export const onTwenty = (grade: Graded) =>
  grade.value === undefined || grade.outOf <= 0
    ? undefined
    : (grade.value / grade.outOf) * 20;

function weighted(grades: readonly Graded[]): number | undefined {
  let sum = 0;
  let weight = 0;
  const extras: [number, number][] = [];
  for (const grade of grades) {
    const value = onTwenty(grade);
    if (value === undefined || grade.coefficient <= 0) {
      continue;
    }
    if (grade.optional || grade.bonus) {
      extras.push([value, grade.coefficient]);
      continue;
    }
    sum += value * grade.coefficient;
    weight += grade.coefficient;
  }
  // Les meilleures d'abord : chacune ne compte que si elle fait encore monter la moyenne.
  for (const [value, coefficient] of extras.sort((a, b) => b[0] - a[0])) {
    if (weight === 0 || value > sum / weight) {
      sum += value * coefficient;
      weight += coefficient;
    }
  }
  return weight > 0 ? sum / weight : undefined;
}

/** Moyenne de chaque matière, sur 20. */
export function subjectAverages(
  grades: readonly Graded[]
): Map<string, number> {
  const bySubject = new Map<string, Graded[]>();
  for (const grade of grades) {
    bySubject.set(grade.subject, [
      ...(bySubject.get(grade.subject) ?? []),
      grade,
    ]);
  }
  const averages = new Map<string, number>();
  for (const [subject, own] of bySubject) {
    const value = weighted(own);
    if (value !== undefined) {
      averages.set(subject, value);
    }
  }
  return averages;
}

/** La moyenne générale sur 20, selon la méthode choisie. */
export function average(
  grades: readonly Graded[],
  method: AverageMethod
): number | undefined {
  if (method === "weighted") {
    return weighted(grades);
  }
  const values =
    method === "subjects"
      ? [...subjectAverages(grades).values()]
      : grades.flatMap(grade => onTwenty(grade) ?? []);
  if (values.length === 0) {
    return undefined;
  }
  if (method === "subjects") {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
  const sorted = values.sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/** La moyenne après chaque jour de notes, dans l'ordre : la courbe d'évolution. */
export function history(
  grades: readonly Graded[],
  method: AverageMethod
): { date: Date; value: number }[] {
  const days = [
    ...new Set(
      grades.map(grade =>
        new Date(
          grade.date.getFullYear(),
          grade.date.getMonth(),
          grade.date.getDate()
        ).getTime()
      )
    ),
  ].sort((a, b) => a - b);
  return days.flatMap(day => {
    const value = average(
      grades.filter(grade => grade.date.getTime() < day + 86_400_000),
      method
    );
    return value === undefined ? [] : [{ date: new Date(day), value }];
  });
}

/** Ce que la note change à la moyenne générale : avec elle, moins sans elle. */
export function influence(
  grades: readonly Graded[],
  grade: Graded,
  method: AverageMethod
): number | undefined {
  const withIt = average(grades, method);
  const without = average(
    grades.filter(other => other !== grade),
    method
  );
  return withIt === undefined || without === undefined
    ? undefined
    : withIt - without;
}
