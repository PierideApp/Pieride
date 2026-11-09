import {
  type Client,
  SchoolLifeAttendanceItemType,
  TimetableCourseType,
} from "@blockshub/blocksdirecte";

import { contentToHtml } from "@/lib/html";
import { addDays } from "@/lib/week";

import { ServiceUnavailable } from "../shared/errors";
import type {
  Attendance,
  Course,
  Grade,
  Homework,
  Period,
  PeriodGrades,
  SubjectAverage,
} from "../shared/models";
import type { CapabilityMethods } from "../shared/plugin";
import { EcoledirecteSession } from "./session";

type MarkScalar = string | number | null;

interface MarkSubjectPayload {
  discipline?: string | null;
  codeMatiere?: string | null;
  moyenne?: MarkScalar;
  moyenneClasse?: MarkScalar;
  moyenneMin?: MarkScalar;
  moyenneMax?: MarkScalar;
}

interface MarkReportPayload {
  moyenneGenerale?: MarkScalar;
  moyenneClasse?: MarkScalar;
  disciplines?: MarkSubjectPayload[] | null;
}

interface MarkPeriodPayload {
  idPeriode?: string | null;
  codePeriode?: string | null;
  periode?: string | null;
  dateDebut: string;
  dateFin: string;
  ensembleMatieres?: MarkReportPayload | null;
}

interface MarkPayload {
  id: string | number;
  date: string;
  codePeriode?: string | null;
  devoir?: string | null;
  commentaire?: string | null;
  libelleMatiere?: string | null;
  codeMatiere?: string | null;
  valeur?: MarkScalar;
  moyenneClasse?: MarkScalar;
  minClasse?: MarkScalar;
  maxClasse?: MarkScalar;
  noteSur?: MarkScalar;
  coef?: MarkScalar;
  nonSignificatif?: boolean;
}

interface MarksPayload {
  periodes: MarkPeriodPayload[];
  notes: MarkPayload[];
}

const MONTHS: Readonly<Record<string, number>> = {
  janvier: 0,
  fevrier: 1,
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  aout: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  decembre: 11,
};

const MAX_NEWS_IMAGE_BYTES = 8 * 1024 * 1024;

function inlineImageMime(bytes: Uint8Array): string | null {
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.subarray(start, end));
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    ascii(1, 4) === "PNG" &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (bytes.length >= 6 && /^GIF8[79]a$/.test(ascii(0, 6))) {
    return "image/gif";
  }
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return "image/webp";
  }
  if (bytes.length >= 12 && ascii(4, 12).startsWith("ftypavif")) {
    return "image/avif";
  }
  return null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

async function imageStreamToDataUrl(
  stream: ReadableStream<Uint8Array> | null
): Promise<string | null> {
  if (!stream) {
    return null;
  }
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      total += value.byteLength;
      if (total > MAX_NEWS_IMAGE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const mime = inlineImageMime(bytes);
  return mime ? `data:${mime};base64,${bytesToBase64(bytes)}` : null;
}

async function inlineProtectedNewsImages(
  client: Client,
  value: string
): Promise<string> {
  const html = contentToHtml(value);
  if (!/<img\b/i.test(html)) {
    return html;
  }
  const images = [...html.matchAll(/<img\b[^>]*>/gi)];
  const replacements = await Promise.all(
    images.map(async ([tag]) => {
      const sourceAttribute = tag.match(
        /\s+src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i
      );
      if (!sourceAttribute) {
        return tag;
      }
      try {
        const source = (
          sourceAttribute[1] ??
          sourceAttribute[2] ??
          sourceAttribute[3] ??
          ""
        )
          .replace(/&amp;|&#0*38;|&#x0*26;/gi, "&")
          .replace(/&quot;|&#0*34;|&#x0*22;/gi, '"')
          .replace(/&apos;|&#0*39;|&#x0*27;/gi, "'");
        const url = new URL(source, "https://api.ecoledirecte.com/");
        if (
          url.protocol !== "https:" ||
          !(
            url.hostname === "ecoledirecte.com" ||
            url.hostname.endsWith(".ecoledirecte.com")
          )
        ) {
          return tag;
        }
        const rawFileId = url.searchParams.get("fichierId");
        const fileType = url.searchParams.get("leTypeDeFichier");
        if (!rawFileId || !/^\d+$/.test(rawFileId) || !fileType?.trim()) {
          return tag;
        }
        const fileId = Number(rawFileId);
        if (!Number.isSafeInteger(fileId)) {
          return tag;
        }
        const dataUrl = await imageStreamToDataUrl(
          await client.downloader.getStream(fileId, fileType)
        );
        return dataUrl
          ? tag.replace(sourceAttribute[0], ` src="${dataUrl}"`)
          : tag;
      } catch {
        // Une image indisponible ne doit pas faire échouer la synchro des actualités.
        return tag;
      }
    })
  );
  let offset = 0;
  let result = "";
  for (const [index, image] of images.entries()) {
    const start = image.index ?? offset;
    result += html.slice(offset, start) + replacements[index];
    offset = start + image[0].length;
  }
  return result + html.slice(offset);
}

function parseNumber(value?: string | number | null): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  const parsed = Number.parseFloat(
    value.trim().replace(/\s/g, "").replace(",", ".")
  );
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseDate(value?: string): Date | undefined {
  if (!value) {
    return undefined;
  }
  const input = value.trim();
  const french = input.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (french) {
    const [, day, month, year, hour = "0", minute = "0", second = "0"] = french;
    const date = new Date(
      +year!,
      +month! - 1,
      +day!,
      +hour!,
      +minute!,
      +second!
    );
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  const normalized = /^\d{4}-\d{2}-\d{2}\s/.test(input)
    ? input.replace(" ", "T")
    : input;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function dateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function toPeriod(period: MarkPeriodPayload): Period | null {
  const start = parseDate(period.dateDebut);
  const end = parseDate(period.dateFin);
  const id = period.codePeriode || period.idPeriode;
  if (!id || !start || !end) {
    return null;
  }
  return { id, name: period.periode || id, start, end };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function isOptionalMarkScalar(value: unknown): value is MarkScalar | undefined {
  return (
    value === undefined ||
    value === null ||
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function isArrayOf<T>(
  value: unknown,
  isItem: (item: unknown) => item is T
): value is T[] {
  return Array.isArray(value) && value.every(isItem);
}

function isMarkSubject(value: unknown): value is MarkSubjectPayload {
  return (
    isRecord(value) &&
    isOptionalString(value.discipline) &&
    isOptionalString(value.codeMatiere) &&
    isOptionalMarkScalar(value.moyenne) &&
    isOptionalMarkScalar(value.moyenneClasse) &&
    isOptionalMarkScalar(value.moyenneMin) &&
    isOptionalMarkScalar(value.moyenneMax)
  );
}

function isMarkReport(value: unknown): value is MarkReportPayload {
  if (!isRecord(value)) {
    return false;
  }
  const disciplines = value.disciplines;
  return (
    isOptionalMarkScalar(value.moyenneGenerale) &&
    isOptionalMarkScalar(value.moyenneClasse) &&
    (disciplines === undefined ||
      disciplines === null ||
      isArrayOf(disciplines, isMarkSubject))
  );
}

function isMarkPeriod(value: unknown): value is MarkPeriodPayload {
  if (!isRecord(value)) {
    return false;
  }
  const report = value.ensembleMatieres;
  return (
    isOptionalString(value.idPeriode) &&
    isOptionalString(value.codePeriode) &&
    isOptionalString(value.periode) &&
    typeof value.dateDebut === "string" &&
    typeof value.dateFin === "string" &&
    (report === undefined || report === null || isMarkReport(report))
  );
}

function isMark(value: unknown): value is MarkPayload {
  return (
    isRecord(value) &&
    ((typeof value.id === "string" && value.id.length > 0) ||
      (typeof value.id === "number" && Number.isSafeInteger(value.id))) &&
    typeof value.date === "string" &&
    isOptionalString(value.codePeriode) &&
    isOptionalString(value.devoir) &&
    isOptionalString(value.commentaire) &&
    isOptionalString(value.libelleMatiere) &&
    isOptionalString(value.codeMatiere) &&
    isOptionalMarkScalar(value.valeur) &&
    isOptionalMarkScalar(value.moyenneClasse) &&
    isOptionalMarkScalar(value.minClasse) &&
    isOptionalMarkScalar(value.maxClasse) &&
    isOptionalMarkScalar(value.noteSur) &&
    isOptionalMarkScalar(value.coef) &&
    (value.nonSignificatif === undefined ||
      typeof value.nonSignificatif === "boolean")
  );
}

export function normalizeMarksResponse(value: unknown): MarksPayload {
  if (!isRecord(value)) {
    throw new ServiceUnavailable("Réponse des notes ÉcoleDirecte incomplète");
  }

  const periods = value.periodes;
  if (!isArrayOf(periods, isMarkPeriod)) {
    throw new ServiceUnavailable("Réponse des notes ÉcoleDirecte incomplète");
  }

  const rawMarks = value.notes;
  if (rawMarks === undefined || rawMarks === null) {
    return { periodes: periods, notes: [] };
  }
  if (!isArrayOf(rawMarks, isMark)) {
    throw new ServiceUnavailable("Liste des notes ÉcoleDirecte invalide");
  }
  return { periodes: periods, notes: rawMarks };
}

async function getMarks(session: EcoledirecteSession): Promise<MarksPayload> {
  return session.run(async client =>
    normalizeMarksResponse(await client.marks.getMark())
  );
}

function numberOrTwenty(value?: string | number | null): number {
  return parseNumber(value) ?? 20;
}

function toSubjectAverage(subject: MarkSubjectPayload): SubjectAverage {
  const student = parseNumber(subject.moyenne);
  const classAverage = parseNumber(subject.moyenneClasse);
  const min = parseNumber(subject.moyenneMin);
  const max = parseNumber(subject.moyenneMax);
  return {
    subject: subject.discipline || subject.codeMatiere || "Matière",
    outOf: 20,
    ...(student !== undefined && { student }),
    ...(classAverage !== undefined && { classAverage }),
    ...(min !== undefined && { min }),
    ...(max !== undefined && { max }),
  };
}

function toGrade(grade: MarkPayload, periodId: string): Grade | null {
  const date = parseDate(grade.date);
  if (!date) {
    return null;
  }
  const value = parseNumber(grade.valeur);
  const classAverage = parseNumber(grade.moyenneClasse);
  const min = parseNumber(grade.minClasse);
  const max = parseNumber(grade.maxClasse);
  const status = typeof grade.valeur === "string" ? grade.valeur.trim() : "";
  return {
    id: `${periodId}-${grade.id}`,
    subject: grade.libelleMatiere || grade.codeMatiere || "Autre",
    periodId,
    title: grade.devoir?.trim() || grade.commentaire?.trim() || "Note",
    date,
    ...(value !== undefined ? { value } : { status: status || "Non notée" }),
    outOf: numberOrTwenty(grade.noteSur),
    coefficient: parseNumber(grade.coef) ?? 1,
    ...(classAverage !== undefined && { classAverage }),
    ...(min !== undefined && { min }),
    ...(max !== undefined && { max }),
    bonus: false,
    optional: grade.nonSignificatif ?? false,
  };
}

function toCourse(
  item: Awaited<
    ReturnType<Client["timetable"]["getTimetableBetweenDates"]>
  >[number]
): Course | null {
  const from = parseDate(item.start_date);
  const to = parseDate(item.end_date);
  if (!from || !to) {
    return null;
  }
  const status = item.isAnnule
    ? "canceled"
    : item.isModifie
      ? "edited"
      : undefined;
  return {
    id: `${item.id}@${from.toISOString()}`,
    subject: item.matiere || item.text || "Cours",
    from,
    to,
    ...(item.salle && { room: item.salle }),
    ...(item.prof && { teacher: item.prof }),
    ...((item.groupe || item.classe) && { group: item.groupe || item.classe }),
    ...(status && { status }),
    ...(item.typeCours === TimetableCourseType.PERMANENCY && {
      subject: item.matiere || item.text || "Étude",
    }),
  };
}

function toHomework(
  subject: Awaited<
    ReturnType<Client["homework"]["getHomeworksForDate"]>
  >["matieres"][number],
  dueAt: Date
): Homework | null {
  const item = subject.aFaire;
  if (!item) {
    return null;
  }
  const givenAt = parseDate(item.donneLe);
  return {
    id: String(item.idDevoir),
    subject: subject.matiere || subject.entityLibelle || "Devoir",
    content: item.contenu || subject.contenuDeSeance?.contenu || "",
    ...(givenAt && { givenAt }),
    dueAt,
    done: item.effectue,
    attachments: [],
  };
}

function normalizeFrench(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/’/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function frenchDate(
  day: string,
  month: string,
  year: string,
  time: string
): Date | null {
  const monthIndex = MONTHS[month];
  if (monthIndex === undefined) {
    return null;
  }
  const [hour = "0", minute = "0"] = time.split(":");
  const date = new Date(+year, monthIndex, +day, +hour, +minute);
  return Number.isNaN(date.getTime()) ? null : date;
}

function attendanceDates(
  displayDate: string,
  fallbackDate?: string
): [Date, Date] | null {
  const normalized = normalizeFrench(displayDate);
  const range = normalized.match(
    /^du [^ ]+ (\d{1,2}) ([^ ]+) (\d{4}) au [^ ]+ (\d{1,2}) ([^ ]+) (\d{4})$/
  );
  if (range) {
    const start = frenchDate(range[1]!, range[2]!, range[3]!, "00:00");
    const end = frenchDate(range[4]!, range[5]!, range[6]!, "23:59");
    return start && end ? [start, end] : null;
  }
  const single = normalized.match(
    /^le [^ ]+ (\d{1,2}) ([^ ]+) (\d{4})(?: de (\d{2}:\d{2}) a (\d{2}:\d{2}))?$/
  );
  if (single) {
    const start = frenchDate(
      single[1]!,
      single[2]!,
      single[3]!,
      single[4] ?? "00:00"
    );
    const end = frenchDate(
      single[1]!,
      single[2]!,
      single[3]!,
      single[5] ?? "23:59"
    );
    return start && end ? [start, end] : null;
  }
  const fallback = parseDate(fallbackDate);
  return fallback
    ? [fallback, new Date(fallback.getTime() + 60 * 60_000)]
    : null;
}

function toAttendance(
  item: Awaited<
    ReturnType<Client["schoollife"]["getSchoolLife"]>
  >["absencesRetards"][number]
): Attendance | null {
  const kind =
    item.typeElement === SchoolLifeAttendanceItemType.ABSENCE
      ? "absence"
      : item.typeElement === SchoolLifeAttendanceItemType.DELAY
        ? "delay"
        : null;
  if (!kind) {
    return null;
  }
  const dates = attendanceDates(item.displayDate, item.date);
  if (!dates) {
    return null;
  }
  const [from, to] = dates;
  return {
    id: String(item.id),
    kind,
    from,
    to,
    durationMinutes: Math.max(
      0,
      Math.round((to.getTime() - from.getTime()) / 60_000)
    ),
    ...(item.motif && { reason: item.motif }),
    justified: item.justifie,
  };
}

export function ecoledirecteCapabilities(session: EcoledirecteSession) {
  // BlocksDirecte vérifie la présence du module par son code, pas le champ `enable`.
  const available = new Set(
    session.selectedAccount.modules.map(module => module.code)
  );

  const timetable: CapabilityMethods["TIMETABLE"] = {
    getWeeklyTimetable: weekStart =>
      session.run(async client => {
        const start = new Date(weekStart);
        start.setHours(0, 0, 0, 0);
        const end = addDays(start, 6);
        end.setHours(23, 59, 59, 999);
        return (
          await client.timetable.getTimetableBetweenDates(start, end)
        ).flatMap(item => toCourse(item) ?? []);
      }),
  };

  const homework: CapabilityMethods["HOMEWORK"] = {
    getHomeworks: weekStart =>
      session.run(async client => {
        const days = await Promise.all(
          Array.from({ length: 7 }, (_, index) =>
            addDays(weekStart, index)
          ).map(async day => ({
            day,
            result: await client.homework.getHomeworksForDate(dateKey(day)),
          }))
        );
        return days.flatMap(({ day, result }) =>
          result.matieres.flatMap(subject => toHomework(subject, day) ?? [])
        );
      }),
    setHomeworkCompletion: (id, done) =>
      session.run(async client => {
        const numericId = Number(id);
        if (!Number.isSafeInteger(numericId)) {
          throw new ServiceUnavailable(
            "Identifiant de devoir ÉcoleDirecte invalide"
          );
        }
        if (done) {
          await client.homework.markHomeworkAsDone(numericId);
        } else {
          await client.homework.markHomeworkAsUndone(numericId);
        }
      }),
  };

  const grades: CapabilityMethods["GRADES"] = {
    getGradesPeriods: async () =>
      (await getMarks(session)).periodes.flatMap(
        period => toPeriod(period) ?? []
      ),
    getGradesForPeriod: async period => {
      const markData = await getMarks(session);
      const record = markData.periodes.find(
        candidate =>
          candidate.codePeriode === period.id ||
          candidate.idPeriode === period.id
      );
      const relevant = markData.notes.filter(grade => {
        if (grade.codePeriode) {
          return grade.codePeriode === period.id;
        }
        const date = parseDate(grade.date);
        return date !== undefined && date >= period.start && date <= period.end;
      });
      const report = record?.ensembleMatieres;
      const student = parseNumber(report?.moyenneGenerale);
      const classAverage = parseNumber(report?.moyenneClasse);
      return {
        grades: relevant.flatMap(grade => toGrade(grade, period.id) ?? []),
        averages: (report?.disciplines ?? []).map(toSubjectAverage),
        ...((student !== undefined || classAverage !== undefined) && {
          overall: {
            ...(student !== undefined && { student }),
            ...(classAverage !== undefined && { classAverage }),
          },
        }),
      } satisfies PeriodGrades;
    },
  };

  const news: CapabilityMethods["NEWS"] = {
    getNews: () =>
      session.run(async client => {
        const timeline = await client.timeline.getPublicTimeline();
        const events = await Promise.all(
          timeline.evenements.map(async event => {
            const date = parseDate(event.dateDebut);
            return date
              ? {
                  id: `event-${event.id}`,
                  title: event.libelle,
                  author: "Établissement",
                  date,
                  content: await inlineProtectedNewsImages(
                    client,
                    event.description || ""
                  ),
                  // Le fil public ne fournit pas d'état de lecture : celui-ci est local.
                  read: false,
                  attachments: [],
                }
              : null;
          })
        );
        const posts = await Promise.all(
          timeline.postits.map(async post => {
            const date = parseDate(post.dateCreation || post.dateDebut);
            return date
              ? {
                  id: `post-${post.id}`,
                  author:
                    [post.auteur.prenom, post.auteur.nom]
                      .filter(Boolean)
                      .join(" ") || "Établissement",
                  date,
                  content: await inlineProtectedNewsImages(
                    client,
                    post.contenu || ""
                  ),
                  // `type` indique la couleur du post-it, pas un titre ni son état de lecture.
                  read: false,
                  attachments: [],
                }
              : null;
          })
        );
        return [...events, ...posts]
          .flatMap(item => (item ? [item] : []))
          .sort((left, right) => right.date.getTime() - left.date.getTime());
      }),
    setNewsAsAcknowledged: async () => undefined,
  };

  const attendance: CapabilityMethods["ATTENDANCE"] = {
    getAttendancePeriods: async () =>
      (await getMarks(session)).periodes
        .filter(period => {
          const label = normalizeFrench(period.periode ?? "");
          return label && !label.startsWith("releve") && label !== "annee";
        })
        .flatMap(period => toPeriod(period) ?? []),
    getAttendanceForPeriod: period =>
      session.run(async client =>
        (await client.schoollife.getSchoolLife()).absencesRetards.flatMap(
          item => {
            const mapped = toAttendance(item);
            return mapped &&
              mapped.from >= period.start &&
              mapped.from <= period.end
              ? [mapped]
              : [];
          }
        )
      ),
  };

  return {
    NEWS: news,
    ...(available.has("EDT") && { TIMETABLE: timetable }),
    ...(available.has("CAHIER_DE_TEXTES") && { HOMEWORK: homework }),
    ...(available.has("NOTES") && { GRADES: grades }),
    ...(available.has("VIE_SCOLAIRE") && { ATTENDANCE: attendance }),
  };
}
