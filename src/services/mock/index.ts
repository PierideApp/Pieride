// Données fictives pour travailler sur les écrans sans compte scolaire (Paramètres >
// Développeur). En dev seulement : l'app publiée ne contient pas ce fichier (services/index.ts).
// Aucun réseau : tout est calculé à partir de la semaine demandée. Élève, professeurs et
// établissement sont inventés, comme sur les maquettes (Camille Martin, 1re G3).
import { ServiceUnavailable } from "../shared/errors";
import type {
  Course,
  CourseContent,
  Grade,
  Homework,
  News,
  Period,
  SubjectAverage,
} from "../shared/models";
import type { ConnectService, SchoolServicePlugin } from "../shared/plugin";

const SUBJECTS = {
  Mathématiques: { room: "B12", teacher: "M. Bernard" },
  "Physique-Chimie": { room: "Labo 2", teacher: "M. Garnier" },
  Français: { room: "A04", teacher: "Mme Lefèvre" },
  "Histoire-Géographie": { room: "A11", teacher: "Mme Dubois" },
  "Anglais LV1": { room: "C03", teacher: "Mme Roux" },
  "Espagnol LV2": { room: "C05", teacher: "M. Navarro" },
  SVT: { room: "Labo 1", teacher: "M. Petit" },
  EPS: { room: "Gymnase", teacher: "M. Moreau" },
  "Enseignement scientifique": { room: "B08", teacher: "Mme Lambert" },
};
type SubjectName = keyof typeof SUBJECTS;

/** Une semaine de 1re générale : [jour (0 = lundi), début, fin, matière, statut]. */
const WEEK: readonly [
  number,
  number,
  number,
  SubjectName,
  Course["status"]?,
][] = [
  [0, 8, 10, "Mathématiques"],
  [0, 10, 11, "Anglais LV1"],
  [0, 13, 15, "Physique-Chimie"],
  [0, 15, 16, "Histoire-Géographie"],
  [1, 8, 10, "Français"],
  [1, 10, 12, "SVT"],
  [1, 14, 16, "EPS"],
  [2, 8, 9, "Espagnol LV2", "canceled"],
  [2, 9, 11, "Mathématiques"],
  [2, 11, 12, "Enseignement scientifique"],
  [3, 8, 10, "Histoire-Géographie"],
  [3, 10, 11, "Anglais LV1", "edited"],
  [3, 13, 15, "Français"],
  [3, 15, 17, "Physique-Chimie", "evaluated"],
  [4, 8, 9, "Mathématiques"],
  [4, 9, 11, "Enseignement scientifique"],
  [4, 11, 12, "Espagnol LV2"],
  [4, 14, 16, "SVT"],
];

/** Le cahier de textes de quelques cours, par leur place dans `WEEK`. */
const CONTENTS: ReadonlyMap<number, CourseContent[]> = new Map([
  [
    0,
    [
      {
        category: "Cours",
        title: "Les suites arithmétiques",
        description:
          "<p>Définition, terme général et somme des premiers termes.</p><p>Exemples 1 à 3 du manuel.</p>",
        attachments: [
          { kind: "file", name: "Fiche suites.pdf", url: "mock:fiche-suites" },
        ],
      },
    ],
  ],
  [
    4,
    [
      {
        category: "Cours",
        title: "Le Malade imaginaire, acte I",
        description: "Lecture analytique de la scène 1.",
        attachments: [],
      },
    ],
  ],
  [
    13,
    [
      {
        category: "Devoir surveillé",
        title: "Évaluation sur les dosages",
        attachments: [],
      },
      {
        category: "Correction",
        description: "Correction du TP 4 en classe.",
        attachments: [],
      },
    ],
  ],
]);

/** Les devoirs de la semaine : [jour du rendu, matière, consigne, fait]. */
const HOMEWORK: readonly [number, SubjectName, string, boolean][] = [
  [0, "Mathématiques", "Exercices 12 à 15 page 84.", true],
  [1, "Français", "Lire l'acte I du « Malade imaginaire ».", false],
  [2, "Anglais LV1", "Préparer l'oral sur un lieu de Londres.", false],
  [3, "Physique-Chimie", "Finir le compte rendu du TP sur les dosages.", false],
  [
    3,
    "Histoire-Géographie",
    "Apprendre la leçon sur l'industrialisation.",
    false,
  ],
  [4, "SVT", "Réviser le chapitre 3 pour l'évaluation.", false],
];

/**
 * Les notes de chaque trimestre : [semaine après le début, matière, intitulé, note
 * (`null` : absent), coefficient, moyenne de la classe].
 */
const GRADES: readonly [
  number,
  SubjectName,
  string,
  number | null,
  number,
  number,
][] = [
  [1, "Mathématiques", "Interrogation sur les suites", 15.5, 1, 12.1],
  [2, "Français", "Commentaire de texte", 13, 2, 11.4],
  [2, "Anglais LV1", "Compréhension orale", 17, 1, 13.2],
  [3, "Physique-Chimie", "Contrôle sur les ondes", 11.5, 2, 10.8],
  [4, "Histoire-Géographie", "Composition", 14, 2, 12.5],
  [5, "SVT", "TP noté", null, 1, 13.9],
  [6, "Mathématiques", "Devoir surveillé", 16.25, 2, 11.7],
  [7, "Espagnol LV2", "Expression écrite", 12, 1, 12.3],
  [8, "Enseignement scientifique", "Exposé", 18, 1, 14.6],
  [9, "EPS", "Course de demi-fond", 15, 1, 14.1],
];

/** `day` jours après `start`, à `hour` heures, en heure locale (juste aux changements d'heure). */
function at(start: Date, day: number, hour = 0): Date {
  const date = new Date(start);
  date.setDate(date.getDate() + day);
  date.setHours(hour, 0, 0, 0);
  return date;
}

/** Les trois trimestres de l'année scolaire de `now` (elle commence en septembre). */
function trimesters(now: Date): Period[] {
  const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const bounds = [
    new Date(year, 8, 1),
    new Date(year, 11, 1),
    new Date(year + 1, 2, 1),
    new Date(year + 1, 6, 1),
  ];
  return bounds.slice(0, 3).map((start, index) => ({
    id: `mock-t${index + 1}-${year}`,
    name: `Trimestre ${index + 1}`,
    start,
    end: new Date((bounds[index + 1] ?? start).getTime() - 1),
  }));
}

/** Actualités inventées, publiées `days` jours avant aujourd'hui. */
const NEWS: readonly (Omit<News, "id" | "date" | "attachments"> & {
  days: number;
})[] = [
  {
    days: 2,
    kind: "information",
    title: "Sortie pédagogique au musée",
    category: "Histoire-géographie",
    author: "Mme Dubois",
    content:
      "<p>Bonjour à tous,</p><p>Les élèves de 1re G3 visiteront le musée le jeudi 5 novembre. Départ à 8h00 devant le lycée, retour vers 17h30.</p><p>Merci de rapporter l'autorisation signée avant vendredi.</p>",
    read: false,
    needsAcknowledgement: true,
    acknowledged: false,
  },
  {
    days: 3,
    kind: "survey",
    title: "Voyage en Espagne",
    category: "Vie scolaire",
    author: "M. Roux",
    content:
      "<p>Participeras-tu au voyage à Madrid au printemps ?</p><p>Quelle option choisis-tu pour l'hébergement ?</p>",
    read: false,
    needsAcknowledgement: false,
    acknowledged: false,
  },
  {
    days: 5,
    kind: "information",
    title: "Conseil de classe du 1er trimestre",
    author: "Direction",
    content:
      "<p>Le conseil de classe de la 1re G3 se tiendra le mardi 8 décembre à 17h30.</p>",
    read: false,
    needsAcknowledgement: false,
    acknowledged: false,
  },
  {
    days: 6,
    kind: "information",
    title: "Semaine du goût : menus spéciaux",
    category: "Restauration",
    author: "Restauration scolaire",
    content:
      "<p>Toute la semaine, le self vous fait voyager avec un menu régional chaque jour.</p>",
    read: true,
    needsAcknowledgement: false,
    acknowledged: false,
  },
  {
    days: 13,
    kind: "information",
    title: "Inscriptions à l'association sportive",
    author: "M. Moreau",
    content:
      "<p>Badminton, escalade, futsal : les inscriptions sont ouvertes jusqu'à vendredi.</p>",
    read: true,
    needsAcknowledgement: false,
    acknowledged: false,
  },
];

/** Absences et retards inventés : [jours avant aujourd'hui, heure, minutes, motif, justifié]. */
const ATTENDANCE: readonly [
  number,
  number,
  number,
  "absence" | "delay",
  string | undefined,
  boolean,
][] = [
  [3, 13, 180, "absence", "Rendez-vous médical", true],
  [9, 15, 60, "absence", undefined, false],
  [16, 8, 120, "absence", "Maladie", true],
  [4, 8, 12, "delay", "Retard du bus", true],
  [8, 9, 5, "delay", undefined, false],
];

/** Le faux service. `now` sert aux notes : seules celles déjà passées existent. */
export function mockPlugin(now = () => new Date()): SchoolServicePlugin {
  // Cocher un devoir ou lire une actualité dure le temps de la session, comme une réponse
  // du service.
  const done = new Map<string, boolean>();
  const read = new Set<string>();
  const acknowledged = new Set<string>();

  return {
    kind: "mock",
    downloadAttachment: async ({ name }) => sampleFile(name),
    capabilities: {
      NEWS: {
        getNews: async () =>
          NEWS.map(({ days, ...item }, index) => {
            const id = `mock-news-${index}`;
            return {
              ...item,
              id,
              date: at(now(), -days, 16),
              read: item.read || read.has(id) || acknowledged.has(id),
              acknowledged: item.acknowledged || acknowledged.has(id),
              attachments: [],
            };
          }),
        setNewsAsRead: async id => {
          read.add(id);
        },
        setNewsAsAcknowledged: async id => {
          acknowledged.add(id);
        },
      },
      ATTENDANCE: {
        getAttendancePeriods: async () => trimesters(now()),
        getAttendanceForPeriod: async period =>
          ATTENDANCE.map(([days, hour, minutes, kind, reason, justified]) => {
            const from = at(now(), -days, hour);
            return {
              id: `mock-${kind}-${days}`,
              kind,
              from,
              to: new Date(from.getTime() + minutes * 60_000),
              durationMinutes: minutes,
              reason,
              justified,
            };
          }).filter(
            item => item.from >= period.start && item.from <= period.end
          ),
      },
      TIMETABLE: {
        getWeeklyTimetable: async weekStart =>
          WEEK.map(([day, from, to, subject, status], index) => ({
            id: `mock-course-${at(weekStart, day, from).getTime()}`,
            subject,
            from: at(weekStart, day, from),
            to: at(weekStart, day, to),
            ...SUBJECTS[subject],
            status,
            contents: CONTENTS.get(index),
          })),
      },
      HOMEWORK: {
        getHomeworks: async weekStart =>
          HOMEWORK.map(([day, subject, content, isDone], index): Homework => {
            const id = `mock-homework-${at(weekStart, day).getTime()}-${index}`;
            return {
              id,
              subject,
              content,
              givenAt: at(weekStart, day - 7, 8),
              dueAt: at(weekStart, day, 8),
              done: done.get(id) ?? isDone,
              attachments: [],
            };
          }),
        setHomeworkCompletion: async (id, value) => void done.set(id, value),
      },
      GRADES: {
        getGradesPeriods: async () => trimesters(now()),
        getGradesForPeriod: async period => {
          const grades = GRADES.map(
            ([week, subject, title, value, coefficient, classAverage], index) =>
              ({
                id: `mock-grade-${period.id}-${index}`,
                subject,
                periodId: period.id,
                title,
                date: at(period.start, week * 7, 12),
                value: value ?? undefined,
                status: value === null ? "Absent" : undefined,
                outOf: 20,
                coefficient,
                classAverage,
                min: Math.max(0, Math.min(value ?? 20, classAverage) - 4),
                max: Math.min(20, Math.max(value ?? 0, classAverage) + 2),
                bonus: false,
                optional: false,
              }) satisfies Grade
          ).filter(grade => grade.date <= now());
          return { grades, averages: averagesOf(grades) };
        },
      },
    },
  };
}

/**
 * Un vrai petit fichier pour chaque pièce jointe fictive, qui dit ce qu'il est : de quoi
 * tester l'ouverture sans compte scolaire. Seulement les types utilisés plus haut.
 */
async function sampleFile(name: string): Promise<Uint8Array> {
  const extension = name.split(".").pop()?.toLowerCase();
  const title = `Document fictif : ${name}`;
  if (extension === "pdf") {
    return samplePdf(title);
  }
  if (extension === "csv") {
    // Le BOM et le point-virgule : un tableur ouvre le fichier en français, accents compris.
    return new TextEncoder().encode(
      "\uFEFFMesure;Volume versé (mL);pH\n1;0;3,1\n2;5;4,8\n3;10;7,0\n4;15;9,2\n"
    );
  }
  if (extension === "png" || extension === "jpg" || extension === "jpeg") {
    return sampleImage(title, extension === "png" ? "image/png" : "image/jpeg");
  }
  throw new ServiceUnavailable(`Pas de fichier fictif pour « .${extension} »`);
}

/** Un PDF d'une page, écrit à la main : Helvetica, police standard, ne connaît que le Latin-1. */
function samplePdf(title: string): Uint8Array {
  const text = title.replace(/[^\x20-\xff]/g, "?").replace(/[\\()]/g, "\\$&");
  const content = `BT /F1 20 Tf 56 770 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  // Un caractère, un octet : la longueur du texte donne les positions de la table `xref`.
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((body, index) => {
    const offset = pdf.length;
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
    return offset;
  });
  const table = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${table}\n%%EOF\n`;
  return Uint8Array.from(pdf, character => character.charCodeAt(0));
}

/** Une image dessinée dans un canevas : un fond pâle et le nom du fichier. */
async function sampleImage(
  title: string,
  type: "image/png" | "image/jpeg"
): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 540;
  const context = canvas.getContext("2d");
  if (context) {
    // Le contenu d'un faux fichier, pas l'interface : les couleurs de la marque, en dur.
    context.fillStyle = "#eceeff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#2b2bc2";
    context.font = "bold 36px sans-serif";
    context.fillText(title, 48, canvas.height / 2);
  }
  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, type)
  );
  if (!blob) {
    throw new ServiceUnavailable("Image fictive impossible à dessiner");
  }
  return new Uint8Array(await blob.arrayBuffer());
}

/** Moyennes fictives de chaque matière : celle des notes, la classe un peu autour. */
function averagesOf(grades: readonly Grade[]): SubjectAverage[] {
  return Object.keys(SUBJECTS).map(subject => {
    const own = grades.filter(
      grade => grade.subject === subject && grade.value !== undefined
    );
    const weight = own.reduce((sum, grade) => sum + grade.coefficient, 0);
    const student = weight
      ? own.reduce(
          (sum, grade) => sum + (grade.value ?? 0) * grade.coefficient,
          0
        ) / weight
      : undefined;
    const classAverage = own.length
      ? own.reduce((sum, grade) => sum + (grade.classAverage ?? 0), 0) /
        own.length
      : undefined;
    return {
      subject,
      student,
      classAverage,
      min: classAverage === undefined ? undefined : classAverage - 5,
      max:
        classAverage === undefined ? undefined : Math.min(20, classAverage + 4),
      outOf: 20,
    };
  });
}

export const connectMock: ConnectService = async () => mockPlugin();
