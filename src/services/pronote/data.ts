// Données PRONOTE vers les modèles communs : emploi du temps, devoirs et notes. D'après
// services/pronote/timetable.ts, homework.ts et grades.ts de Papillon (GPLv3).
import {
  type Assignment,
  assignmentsFromIntervals,
  assignmentStatus,
  AttachmentKind,
  type Grade as PronoteGrade,
  GradeKind,
  gradesOverview,
  type GradeValue,
  parseTimetable,
  TabLocation,
  type Timetable,
  timetableFromIntervals,
} from "@blockshub/pawnote-lts";

import type { Course, Grade, Homework, Period } from "../shared/models";
import type { CapabilityMethods } from "../shared/plugin";
import type { PronoteSession } from "./session";

type TimetableItem = Timetable["classes"][number];

/** Les statuts de PRONOTE qui veulent dire que le cours n'a pas lieu (repris de Papillon). */
const CANCELED = new Set([
  "Cours annulé",
  "Prof. absent",
  "Classe absente",
  "Prof./pers. absent",
  "Sortie pédagogique",
]);

const joined = (names: readonly string[]) => names.join(", ") || undefined;

type Lesson = Extract<TimetableItem, { is: "lesson" }>;

function courseStatus(lesson: Lesson): Course["status"] {
  if (lesson.canceled || (lesson.status && CANCELED.has(lesson.status))) {
    return "canceled";
  }
  if (lesson.test) {
    return "evaluated";
  }
  // « Cours modifié », « Changement de salle », « Remplacement »…
  if (lesson.status) {
    return "edited";
  }
  return lesson.virtualClassrooms.length > 0 ? "online" : undefined;
}

export function toCourse(item: TimetableItem): Course {
  const base = { id: item.id, from: item.startDate, to: item.endDate };
  if (item.is === "activity") {
    return { ...base, subject: item.title };
  }
  if (item.is === "detention") {
    return {
      ...base,
      subject: item.title ?? "Retenue",
      room: joined(item.classrooms),
      teacher: joined(item.teacherNames),
    };
  }
  return {
    ...base,
    subject: item.subject?.name ?? item.status ?? "Cours",
    room: joined(item.classrooms),
    teacher: joined(item.teacherNames),
    group: joined(item.groupNames),
    status: courseStatus(item),
  };
}

export function toHomework(assignment: Assignment): Homework {
  return {
    id: assignment.id,
    subject: assignment.subject.name,
    content: assignment.description,
    dueAt: assignment.deadline,
    done: assignment.done,
    attachments: assignment.attachments.map(attachment => ({
      kind: attachment.kind === AttachmentKind.Link ? "link" : "file",
      name: attachment.name,
      url: attachment.url,
    })),
  };
}

/** Une valeur de PRONOTE en points, si c'en est une (une moyenne vide vaut `NaN`). */
const points = (value: GradeValue | undefined) =>
  value?.kind === GradeKind.Grade && Number.isFinite(value.points)
    ? value.points
    : undefined;

/** Ce qu'affiche une note sans points (libellés de Papillon ; `*` : compte comme un 0). */
const STATUS: Partial<Record<GradeKind, string>> = {
  [GradeKind.Absent]: "Abs.",
  [GradeKind.Exempted]: "Disp.",
  [GradeKind.NotGraded]: "N. Not.",
  [GradeKind.Unfit]: "Disp.",
  [GradeKind.Unreturned]: "N. Rendu",
  [GradeKind.AbsentZero]: "Abs.*",
  [GradeKind.UnreturnedZero]: "N. Rendu*",
  [GradeKind.Congratulations]: "Félicitations",
};

export function toGrade(grade: PronoteGrade, periodId: string): Grade {
  const zero =
    grade.value.kind === GradeKind.AbsentZero ||
    grade.value.kind === GradeKind.UnreturnedZero;
  return {
    id: grade.id,
    subject: grade.subject.name,
    periodId,
    title: grade.comment,
    date: grade.date,
    value: zero ? 0 : points(grade.value),
    status: STATUS[grade.value.kind],
    outOf: points(grade.outOf) ?? 20,
    coefficient: grade.coefficient,
    classAverage: points(grade.average),
    min: points(grade.min),
    max: points(grade.max),
    bonus: grade.isBonus,
    optional: grade.isOptional,
  };
}

function weekEnd(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 7);
  return end;
}

/** Les capabilities des onglets ouverts à l'élève, comme Papillon. */
export function capabilities(
  session: PronoteSession,
  tabs: readonly TabLocation[]
): Partial<CapabilityMethods> {
  const timetable: CapabilityMethods["TIMETABLE"] = {
    getWeeklyTimetable: weekStart =>
      session.run(async handle => {
        const found = await timetableFromIntervals(
          handle,
          weekStart,
          weekEnd(weekStart)
        );
        parseTimetable(handle, found, {
          withSuperposedCanceledClasses: false,
          withCanceledClasses: true,
          withPlannedClasses: true,
        });
        return found.classes.map(toCourse);
      }),
  };
  const homework: CapabilityMethods["HOMEWORK"] = {
    getHomeworks: weekStart =>
      session.run(async handle =>
        (
          await assignmentsFromIntervals(handle, weekStart, weekEnd(weekStart))
        ).map(toHomework)
      ),
    setHomeworkCompletion: (id, done) =>
      session.run(handle => assignmentStatus(handle, id, done)),
  };
  const grades: CapabilityMethods["GRADES"] = {
    getGradesPeriods: () =>
      session.run(async handle =>
        (handle.userResource.tabs.get(TabLocation.Grades)?.periods ?? []).map(
          (period): Period => ({
            id: period.id,
            name: period.name,
            start: period.startDate,
            end: period.endDate,
          })
        )
      ),
    getGradesForPeriod: period =>
      session.run(async handle => {
        // Par le nom, comme Papillon : il ne change pas d'une session à l'autre.
        const found = handle.userResource.tabs
          .get(TabLocation.Grades)
          ?.periods.find(candidate => candidate.name === period.name);
        if (!found) {
          return { grades: [], subjects: [] };
        }
        const overview = await gradesOverview(handle, found);
        return {
          grades: overview.grades.map(grade => toGrade(grade, period.id)),
          subjects: overview.subjectsAverages.map(
            average => average.subject.name
          ),
        };
      }),
  };
  return {
    ...(tabs.includes(TabLocation.Timetable) && { TIMETABLE: timetable }),
    ...(tabs.includes(TabLocation.Assignments) && { HOMEWORK: homework }),
    ...(tabs.includes(TabLocation.Grades) && { GRADES: grades }),
  };
}
