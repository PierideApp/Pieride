// Données PRONOTE vers les modèles communs : emploi du temps, devoirs et notes d'après
// services/pronote/timetable.ts, homework.ts et grades.ts de Papillon (GPLv3) ; cahier de
// textes, actualités et carnet (absences, retards) d'après les types de pawnote ; contenu des
// actualités des versions récentes de PRONOTE d'après pronotepy (MIT, `Information`).
import {
  type Assignment,
  assignmentsFromWeek,
  assignmentStatus,
  type Attachment as PronoteAttachment,
  AttachmentKind,
  BusyPageError,
  type Grade as PronoteGrade,
  GradeKind,
  gradesOverview,
  type GradeValue,
  news,
  type NewsCategory,
  newsDetails,
  type NewsInformation,
  newsInformationAcknowledge,
  type NewsItem,
  newsRead,
  type NewsSurvey,
  type Notebook,
  notebook,
  PageUnavailableError,
  parseTimetable,
  RateLimitedError,
  type ResourceContent,
  resourcesFromWeek,
  SessionExpiredError,
  type SessionHandle,
  SuspendedIPError,
  TabLocation,
  type Timetable,
  timetableFromWeek,
  translateToWeekNumber,
} from "@blockshub/pawnote-lts";

import { log } from "@/lib/log";

import { ServiceUnavailable } from "../shared/errors";
import type {
  Attachment,
  Attendance,
  Course,
  CourseContent,
  Grade,
  Homework,
  News,
  Period,
} from "../shared/models";
import type { CapabilityMethods } from "../shared/plugin";
import { lostExchange, type PronoteSession } from "./session";

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

/** `contents` : le cahier de textes de la semaine, par identifiant PRONOTE. */
export function toCourse(
  item: TimetableItem,
  contents?: ReadonlyMap<string, CourseContent[]>
): Course {
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
    contents:
      item.lessonResourceID === undefined
        ? undefined
        : contents?.get(item.lessonResourceID),
  };
}

/**
 * Où retrouver une pièce jointe pour en redemander l'adresse : PRONOTE y chiffre le fichier
 * avec la clé de la session. `week` : la semaine des devoirs ou du cahier de textes.
 */
type Origin =
  | { source: "news"; news: string }
  | { source: "homework" | "resources"; week: number };

/**
 * L'adresse d'un fichier porte l'identifiant de la session PRONOTE (`?Session=`) : on ne le
 * garde pas. Elle ne sert plus de toute façon une fois la session finie : `ref` dit où en
 * redemander une (`downloadAttachment`).
 */
const toAttachment =
  (origin: Origin) =>
  (attachment: PronoteAttachment): Attachment =>
    attachment.kind === AttachmentKind.Link
      ? { kind: "link", name: attachment.name, url: attachment.url }
      : {
          kind: "file",
          name: attachment.name,
          url: attachment.url.split("?")[0] ?? "",
          ref: JSON.stringify({ ...origin, file: attachment.id }),
        };

/** La `ref` d'une pièce jointe, ou `null` si elle est illisible (ligne d'avant les `ref`). */
function parseRef(ref: string | undefined): (Origin & { file: string }) | null {
  let value: unknown;
  try {
    value = JSON.parse(ref ?? "");
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const fields: Partial<Record<"source" | "news" | "week" | "file", unknown>> =
    value;
  const { source, news: newsId, week, file } = fields;
  if (typeof file !== "string") {
    return null;
  }
  if (source === "news" && typeof newsId === "string") {
    return { source, news: newsId, file };
  }
  if (
    (source === "homework" || source === "resources") &&
    typeof week === "number"
  ) {
    return { source, week, file };
  }
  return null;
}

/**
 * La clé d'une actualité : sa date de création, son auteur et son titre. L'id de PRONOTE
 * change d'une connexion à l'autre (relevé par Papillon, database/useNews.ts), et la session
 * est refaite toutes les 5 minutes : il ne retrouverait pas l'actualité synchronisée.
 * `getTime()` plutôt que `toISOString()`, qui lève une erreur sur une date invalide.
 */
const newsKey = (item: NewsItem) =>
  `${item.creationDate.getTime()}|${item.author}|${item.title ?? ""}`;

/**
 * L'actualité de cette session qui porte la clé `key`. Une erreur si elle a disparu (retirée
 * par l'établissement) : rien ne doit être noté comme lu ou accusé sans l'avoir été.
 */
export function pickNews<T extends NewsItem>(
  items: readonly T[],
  key: string
): T {
  const item = items.find(candidate => newsKey(candidate) === key);
  if (!item) {
    throw new ServiceUnavailable("Actualité introuvable chez PRONOTE");
  }
  return item;
}

/** L'actualité telle que PRONOTE l'a envoyée : il la veut ainsi pour la marquer. */
const findNews = async (handle: SessionHandle, key: string) =>
  pickNews((await news(handle)).items, key);

/**
 * Vrai quand PRONOTE n'a pas envoyé le contenu avec la liste (texte, pièces jointes, accusé
 * demandé) : les versions récentes le donnent à part, une requête par actualité.
 */
export const withoutContent = (item: NewsInformation | NewsSurvey) =>
  item.is === "information"
    ? item.question === undefined
    : item.questions.length === 0;

/** L'actualité avec son contenu, demandé à PRONOTE s'il manque (`newsDetails`, notre patch). */
const detailed = async <T extends NewsInformation | NewsSurvey>(
  handle: SessionHandle,
  item: T
): Promise<T> => (withoutContent(item) ? newsDetails(handle, item) : item);

/**
 * Une actualité enregistrée sans texte ni pièce jointe : son contenu avait échoué
 * (`newsWithContent`), il est redemandé.
 */
const hasContent = (item: News) =>
  item.content !== "" || item.attachments.length > 0;

/** Ce que le journal garde d'un contenu en échec, masqué par `log`. */
const describe = (error: unknown) =>
  error instanceof Error
    ? `${error.name} ${error.message.slice(0, 200)}`
    : "Unknown";

/**
 * Les actualités avec leur contenu. Celui d'une actualité déjà en base (`known`, par clé) est
 * repris : seules les nouvelles coûtent une requête de plus. Le reste (lue, rubrique) vient de
 * la liste, toujours à jour. Un contenu en échec n'empêche pas les autres : l'actualité est
 * gardée sans texte, et redemandée à la synchro suivante.
 */
export async function newsWithContent(
  handle: SessionHandle,
  known: ReadonlyMap<string, News>
): Promise<News[]> {
  const list: News[] = [];
  let missing = 0;
  let failure: string | undefined;
  let stop = false;
  // L'une après l'autre : PRONOTE numérote ses requêtes.
  for (const item of (await news(handle)).items) {
    const cached = known.get(newsKey(item));
    if (!withoutContent(item)) {
      list.push(toNews(item));
    } else if (cached && hasContent(cached)) {
      const { content, attachments, needsAcknowledgement, acknowledged } =
        cached;
      list.push({
        ...toNews(item),
        content,
        attachments,
        needsAcknowledgement,
        acknowledged,
      });
    } else if (stop) {
      missing++;
      list.push(toNews(item));
    } else {
      try {
        list.push(toNews(await newsDetails(handle, item)));
      } catch (error) {
        // Toute la session est en cause : `PronoteSession.run` la refait ou attend.
        if (
          error instanceof SessionExpiredError ||
          error instanceof SuspendedIPError ||
          error instanceof RateLimitedError
        ) {
          throw error;
        }
        missing++;
        failure ??= describe(error);
        list.push(toNews(item));
        // Requête perdue ou PRONOTE indisponible : les suivantes échoueraient aussi. Un refus
        // ou un format que pawnote ne lit pas ne concerne que cette actualité.
        stop =
          lostExchange(handle) ||
          error instanceof BusyPageError ||
          error instanceof PageUnavailableError;
      }
    }
  }
  if (failure) {
    log(
      "warn",
      "sync",
      `pronote NEWS : ${missing} contenu(s) manquant(s), ${failure}`
    );
  }
  return list;
}

/**
 * Le fichier d'une pièce jointe parmi ceux de cette session : par son id, ou dans une
 * actualité par son nom, l'id pouvant changer comme celui de l'actualité. Pas par le nom
 * dans une semaine de devoirs : deux matières y ont souvent un même « exercices.pdf ».
 */
export function pickFile(
  files: readonly PronoteAttachment[],
  ref: Origin & { file: string },
  name: string
): PronoteAttachment | undefined {
  return (
    files.find(candidate => candidate.id === ref.file) ??
    (ref.source === "news"
      ? files.find(candidate => candidate.name === name)
      : undefined)
  );
}

/** Les fichiers de l'endroit d'où vient la pièce jointe, avec les adresses de cette session. */
async function filesAt(
  handle: SessionHandle,
  origin: Origin
): Promise<readonly PronoteAttachment[]> {
  if (origin.source === "news") {
    const item = await detailed(handle, await findNews(handle, origin.news));
    return item.is === "information"
      ? item.attachments
      : item.questions.flatMap(question => question.attachments);
  }
  if (origin.source === "homework") {
    return (await assignmentsFromWeek(handle, origin.week)).flatMap(
      assignment => assignment.attachments
    );
  }
  return (await resourcesFromWeek(handle, origin.week)).flatMap(resource =>
    resource.contents.flatMap(content => content.files)
  );
}

/** Le contenu d'un fichier, retrouvé là où il a été vu pour avoir une adresse valable. */
export const downloadAttachment =
  (session: PronoteSession) => (attachment: Attachment) =>
    session.run(async handle => {
      const ref = parseRef(attachment.ref);
      const file =
        ref && pickFile(await filesAt(handle, ref), ref, attachment.name);
      if (!file) {
        throw new ServiceUnavailable("Pièce jointe introuvable chez PRONOTE");
      }
      const response = await fetch(file.url);
      if (!response.ok) {
        throw new ServiceUnavailable(
          `Pièce jointe refusée par PRONOTE : ${response.status}`
        );
      }
      return new Uint8Array(await response.arrayBuffer());
    });

const toCourseContent =
  (week: number) =>
  (content: ResourceContent): CourseContent => ({
    title: content.title,
    description: content.description,
    category: content.categoryText,
    attachments: content.files.map(toAttachment({ source: "resources", week })),
  });

/** `week` : la semaine PRONOTE où les devoirs ont été demandés, pour leurs pièces jointes. */
export function toHomework(assignment: Assignment, week: number): Homework {
  return {
    id: assignment.id,
    subject: assignment.subject.name,
    content: assignment.description,
    dueAt: assignment.deadline,
    done: assignment.done,
    attachments: assignment.attachments.map(
      toAttachment({ source: "homework", week })
    ),
  };
}

/**
 * Une information ou un sondage. La date est celle de la création, avec son heure, comme
 * dans Papillon et la maquette ; le début de diffusion peut n'en pas avoir. Un sondage ne se
 * remplit que sur PRONOTE : on garde le texte et les pièces jointes de ses questions.
 */
export function toNews(item: NewsInformation | NewsSurvey): News {
  // pawnote cherche la rubrique dans la liste reçue : elle peut manquer.
  const category: NewsCategory | undefined = item.category;
  const id = newsKey(item);
  const attachment = toAttachment({ source: "news", news: id });
  const common = {
    id,
    title: item.title,
    category: category?.name,
    author: item.author,
    date: item.creationDate,
    read: item.read,
  };
  if (item.is === "survey") {
    return {
      ...common,
      kind: "survey",
      content: item.questions.map(question => question.content).join(""),
      needsAcknowledgement: false,
      acknowledged: false,
      attachments: item.questions.flatMap(question =>
        question.attachments.map(attachment)
      ),
    };
  }
  return {
    ...common,
    kind: "information",
    content: item.content,
    needsAcknowledgement: item.needToAcknowledge,
    acknowledged: item.acknowledged,
    attachments: item.attachments.map(attachment),
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
        const week = weekNumber(handle, weekStart);
        const found = await timetableFromWeek(handle, week);
        parseTimetable(handle, found, {
          withSuperposedCanceledClasses: false,
          withCanceledClasses: true,
          withPlannedClasses: true,
        });
        // Le cahier de textes de toute la semaine en une requête, si l'élève y a accès.
        const resources = tabs.includes(TabLocation.Resources)
          ? await resourcesFromWeek(handle, week)
          : [];
        const contents = new Map(
          resources.map(resource => [
            resource.id,
            resource.contents.map(toCourseContent(week)),
          ])
        );
        return found.classes.map(item => toCourse(item, contents));
      }),
  };
  const homework: CapabilityMethods["HOMEWORK"] = {
    getHomeworks: weekStart =>
      session.run(async handle => {
        const week = weekNumber(handle, weekStart);
        return (await assignmentsFromWeek(handle, week)).map(assignment =>
          toHomework(assignment, week)
        );
      }),
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
    getNews: known => session.run(handle => newsWithContent(handle, known)),
    setNewsAsRead: id =>
      session.run(async handle =>
        newsRead(handle, await findNews(handle, id), true)
      ),
    setNewsAsAcknowledged: id =>
      session.run(async handle => {
        const item = await detailed(handle, await findNews(handle, id));
        if (item.is !== "information") {
          throw new ServiceUnavailable(
            "Un sondage n'a pas d'accusé de réception"
          );
        }
        await newsInformationAcknowledge(handle, item);
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
