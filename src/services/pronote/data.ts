// Données PRONOTE vers les modèles communs : emploi du temps, devoirs et notes d'après
// services/pronote/timetable.ts, homework.ts et grades.ts de Papillon (GPLv3) ; actualités et
// carnet (absences, retards) d'après les types de pawnote.
import {
  type Assignment,
  assignmentsFromWeek,
  assignmentStatus,
  type Attachment as PronoteAttachment,
  AttachmentKind,
  type Grade as PronoteGrade,
  GradeKind,
  gradesOverview,
  type GradeValue,
  news,
  type NewsInformation,
  newsRead,
  type Notebook,
  notebook,
  parseTimetable,
  type SessionHandle,
  TabLocation,
  type Timetable,
  timetableFromWeek,
  translateToWeekNumber,
} from "@blockshub/pawnote-lts";

import type {
  Attachment,
  Attendance,
  Course,
  Grade,
  Homework,
  News,
  Period,
} from "../shared/models";
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
  // Un cours qui revient chaque semaine garde son identifiant PRONOTE : l'heure de début en
  // fait une séance unique.
  const base = {
    id: `${item.id}@${item.startDate.toISOString()}`,
    from: item.startDate,
    to: item.endDate,
  };
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

/**
 * L'adresse d'un fichier porte l'identifiant de la session PRONOTE (`?Session=`) : on ne le
 * garde pas. Elle ne sert plus de toute façon une fois la session finie.
 */
const toAttachment = (attachment: PronoteAttachment): Attachment =>
  attachment.kind === AttachmentKind.Link
    ? { kind: "link", name: attachment.name, url: attachment.url }
    : {
        kind: "file",
        name: attachment.name,
        url: attachment.url.split("?")[0] ?? "",
      };

export function toHomework(assignment: Assignment): Homework {
  return {
    id: assignment.id,
    subject: assignment.subject.name,
    content: assignment.description,
    dueAt: assignment.deadline,
    done: assignment.done,
    attachments: assignment.attachments.map(toAttachment),
  };
}

export function toNews(item: NewsInformation): News {
  return {
    id: item.id,
    title: item.title,
    author: item.author,
    date: item.startDate,
    content: item.content,
    read: item.read,
    attachments: item.attachments.map(toAttachment),
  };
}

export function toAttendance(book: Notebook): Attendance[] {
  return [
    ...book.absences.map((absence): Attendance => ({
      id: absence.id,
      kind: "absence",
      from: absence.startDate,
      to: absence.endDate,
      durationMinutes: absence.hoursMissed * 60 + absence.minutesMissed,
      reason: absence.reason,
      justified: absence.justified,
    })),
    ...book.delays.map((delay): Attendance => ({
      id: delay.id,
      kind: "delay",
      from: delay.date,
      to: new Date(delay.date.getTime() + delay.minutes * 60_000),
      durationMinutes: delay.minutes,
      reason: delay.reason ?? delay.justification,
      justified: delay.justified,
    })),
  ];
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

/**
 * Le numéro PRONOTE de la semaine, comme Papillon : demandée par dates (du lundi au lundi),
 * elle déborde sur le lundi suivant.
 */
const weekNumber = (handle: SessionHandle, weekStart: Date) =>
  translateToWeekNumber(weekStart, handle.instance.firstMonday);

/** Les capabilities des onglets ouverts à l'élève, comme Papillon. */
export function capabilities(
  session: PronoteSession,
  tabs: readonly TabLocation[]
): Partial<CapabilityMethods> {
  const timetable: CapabilityMethods["TIMETABLE"] = {
    getWeeklyTimetable: weekStart =>
      session.run(async handle => {
        const found = await timetableFromWeek(
          handle,
          weekNumber(handle, weekStart)
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
        (await assignmentsFromWeek(handle, weekNumber(handle, weekStart))).map(
          toHomework
        )
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
          return { grades: [], averages: [] };
        }
        const overview = await gradesOverview(handle, found);
        return {
          grades: overview.grades.map(grade => toGrade(grade, period.id)),
          averages: overview.subjectsAverages.map(average => ({
            subject: average.subject.name,
            student: points(average.student),
            classAverage: points(average.class_average),
            min: points(average.min),
            max: points(average.max),
            outOf: points(average.outOf) ?? 20,
          })),
          overall: {
            student: points(overview.overallAverage),
            classAverage: points(overview.classAverage),
          },
        };
      }),
  };
  const newsMethods: CapabilityMethods["NEWS"] = {
    getNews: () =>
      session.run(async handle =>
        (await news(handle)).items
          .filter((item): item is NewsInformation => item.is === "information")
          .map(toNews)
      ),
    setNewsAsAcknowledged: id =>
      session.run(async handle => {
        const item = (await news(handle)).items.find(
          candidate => candidate.id === id
        );
        if (item) {
          await newsRead(handle, item, true);
        }
      }),
  };
  const attendanceMethods: CapabilityMethods["ATTENDANCE"] = {
    getAttendancePeriods: () =>
      session.run(async handle =>
        (handle.userResource.tabs.get(TabLocation.Notebook)?.periods ?? []).map(
          (period): Period => ({
            id: period.id,
            name: period.name,
            start: period.startDate,
            end: period.endDate,
          })
        )
      ),
    getAttendanceForPeriod: period =>
      session.run(async handle => {
        const found = handle.userResource.tabs
          .get(TabLocation.Notebook)
          ?.periods.find(candidate => candidate.name === period.name);
        return found ? toAttendance(await notebook(handle, found)) : [];
      }),
  };
  return {
    ...(tabs.includes(TabLocation.News) && { NEWS: newsMethods }),
    ...(tabs.includes(TabLocation.Notebook) && {
      ATTENDANCE: attendanceMethods,
    }),
    ...(tabs.includes(TabLocation.Timetable) && { TIMETABLE: timetable }),
    ...(tabs.includes(TabLocation.Assignments) && { HOMEWORK: homework }),
    ...(tabs.includes(TabLocation.Grades) && { GRADES: grades }),
  };
}
