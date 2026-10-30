// Les notes d'un compte (Notes, Accueil) : périodes avec leurs moyennes générales, notes avec
// l'apparence de leur matière, moyennes par matière données par le service. Relues après
// chaque synchronisation.
import { and, eq } from "drizzle-orm";

import { db } from "@/database";
import {
  grades,
  periods,
  services,
  subjectAverages,
  subjects,
} from "@/database/schema";
import { subjectLook } from "@/lib/subjects";
import type { Grade, Period, SubjectAverage } from "@/services/shared/models";

import { Source, useQuery } from "./useQuery";

export interface PeriodView extends Period {
  serviceId: string;
  /** Moyennes générales de l'élève et de la classe, données par le service. */
  average?: number;
  classAverage?: number;
}

export interface GradeView extends Grade {
  serviceId: string;
  /** Nom, couleur et emoji de la matière (Paramètres > Matières). */
  label: string;
  color: string;
  emoji: string;
}

export interface SubjectAverageView extends SubjectAverage {
  serviceId: string;
  periodId: string;
}

export interface GradesData {
  periods: PeriodView[];
  grades: GradeView[];
  averages: SubjectAverageView[];
}

const orUndefined = <T>(value: T | null) => value ?? undefined;

async function loadGrades(accountId: string): Promise<GradesData> {
  const own = eq(services.accountId, accountId);
  const [periodRows, gradeRows, averageRows] = await Promise.all([
    db
      .select({ period: periods })
      .from(periods)
      .innerJoin(services, eq(services.id, periods.serviceId))
      .where(own)
      .orderBy(periods.start),
    db
      .select({
        grade: grades,
        displayName: subjects.displayName,
        color: subjects.color,
        emoji: subjects.emoji,
      })
      .from(grades)
      .innerJoin(services, eq(services.id, grades.serviceId))
      .leftJoin(
        subjects,
        and(
          eq(subjects.serviceId, grades.serviceId),
          eq(subjects.name, grades.subject)
        )
      )
      .where(own)
      .orderBy(grades.date),
    db
      .select({ average: subjectAverages })
      .from(subjectAverages)
      .innerJoin(services, eq(services.id, subjectAverages.serviceId))
      .where(own),
  ]);
  return {
    periods: periodRows.map(({ period }) => ({
      ...period,
      average: orUndefined(period.average),
      classAverage: orUndefined(period.classAverage),
    })),
    grades: gradeRows.map(({ grade, ...chosen }) => ({
      ...grade,
      value: orUndefined(grade.value),
      status: orUndefined(grade.status),
      classAverage: orUndefined(grade.classAverage),
      min: orUndefined(grade.min),
      max: orUndefined(grade.max),
      ...subjectLook(grade.subject, chosen),
    })),
    averages: averageRows.map(({ average }) => ({
      ...average,
      student: orUndefined(average.student),
      classAverage: orUndefined(average.classAverage),
      min: orUndefined(average.min),
      max: orUndefined(average.max),
    })),
  };
}

/** La période en cours, sinon la dernière qui a des notes, sinon la première. */
export function currentPeriod(
  periods: readonly PeriodView[],
  grades: readonly GradeView[],
  now: Date
): PeriodView | undefined {
  return (
    periods.find(period => period.start <= now && now <= period.end) ??
    [...periods]
      .reverse()
      .find(period =>
        grades.some(
          grade =>
            grade.serviceId === period.serviceId && grade.periodId === period.id
        )
      ) ??
    periods[0]
  );
}

/** Les notes d'une période. */
export const gradesOf = (
  grades: readonly GradeView[],
  period: PeriodView | undefined
) =>
  period
    ? grades.filter(
        grade =>
          grade.serviceId === period.serviceId && grade.periodId === period.id
      )
    : [];

const source = new Source<GradesData>("grades", "subjects");

export function useGrades(accountId: string | undefined) {
  return useQuery(source, `${accountId}`, () =>
    accountId
      ? loadGrades(accountId)
      : Promise.resolve({ periods: [], grades: [], averages: [] })
  );
}
