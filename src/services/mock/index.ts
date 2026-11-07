// Données fictives pour travailler sur les écrans sans compte scolaire (Paramètres >
// Développeur). En dev seulement : l'app publiée ne contient pas ce fichier (services/index.ts).
// Aucun réseau : tout est calculé à partir de la semaine demandée. Élève, professeurs et
// établissement sont inventés, comme sur les maquettes (Camille Martin, 1re G3).
import { ServiceUnavailable } from "../shared/errors";
import type {
  Attachment,
  Course,
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
const isSubject = (name: string): name is SubjectName => name in SUBJECTS;

/** Pièce jointe fictive : un fichier (`mock:`, rien à télécharger) ou un lien. */
const file = (name: string): Attachment => ({
  kind: "file",
  name,
  url: `mock:${name}`,
});
const link = (name: string, url: string): Attachment => ({
  kind: "link",
  name,
  url,
});

/**
 * Une semaine de 1re générale, avec tout ce que PRONOTE peut renvoyer : cours annulé, modifié
 * (changement de salle), à distance, évalué ; groupes, deux professeurs, activité sans
 * matière ni salle ; cahier de textes en HTML avec fichiers et liens. `day` : 0 = lundi.
 */
const WEEK: readonly (Omit<Course, "id" | "from" | "to" | "subject"> & {
  day: number;
  from: number;
  to: number;
  /** Une matière de `SUBJECTS` (salle et professeur par défaut), ou un intitulé libre. */
  subject: string;
})[] = [
  {
    day: 0,
    from: 8,
    to: 10,
    subject: "Mathématiques",
    contents: [
      {
        category: "Cours",
        title: "Les suites arithmétiques",
        description:
          "<p>Définition, terme général et <strong>somme des premiers termes</strong>.</p><p>Exemples 1 à 3 du manuel.</p>",
        attachments: [
          file("Fiche suites.pdf"),
          link("Exercices en ligne", "https://www.example.com/suites"),
        ],
      },
    ],
  },
  {
    day: 0,
    from: 10,
    to: 11,
    subject: "Anglais LV1",
    contents: [
      {
        category: "Cours",
        title: "London landmarks",
        description:
          "<p>Vocabulaire des lieux et des directions. Vidéo vue en classe :</p>",
        attachments: [
          link("A walk in London (vidéo)", "https://www.example.com/london"),
        ],
      },
    ],
  },
  { day: 0, from: 13, to: 15, subject: "Physique-Chimie" },
  { day: 0, from: 15, to: 16, subject: "Histoire-Géographie" },
  {
    day: 1,
    from: 8,
    to: 10,
    subject: "Français",
    contents: [
      {
        category: "Cours",
        title: "Le Malade imaginaire, acte I",
        description: "Lecture analytique de la scène 1.",
        attachments: [file("Le Malade imaginaire, acte I.pdf")],
      },
    ],
  },
  {
    day: 1,
    from: 10,
    to: 12,
    subject: "SVT",
    group: "1re G3 demi-groupe A",
    contents: [
      {
        category: "Travaux pratiques",
        title: "Observation de cellules au microscope",
        attachments: [
          file("Protocole TP 5.pdf"),
          file("Schéma à compléter.png"),
        ],
      },
    ],
  },
  { day: 1, from: 14, to: 16, subject: "EPS" },
  {
    day: 2,
    from: 8,
    to: 9,
    subject: "Espagnol LV2",
    group: "Espagnol LV2 groupe 2",
    status: "canceled",
  },
  { day: 2, from: 9, to: 11, subject: "Mathématiques" },
  {
    day: 2,
    from: 11,
    to: 12,
    subject: "Enseignement scientifique",
    status: "online",
  },
  { day: 2, from: 13, to: 16, subject: "Sortie au musée d'Orsay" },
  {
    day: 3,
    from: 8,
    to: 10,
    subject: "Histoire-Géographie",
    contents: [
      {
        category: "Cours",
        title: "L'industrialisation en Europe",
        description:
          "<p>Trois idées à retenir :</p><ul><li>les sources d'énergie</li><li>le chemin de fer</li><li>la naissance du monde ouvrier</li></ul>",
        attachments: [
          file("Carte de l'Europe industrielle.jpg"),
          file("Questionnaire.pdf"),
        ],
      },
    ],
  },
  {
    day: 3,
    from: 10,
    to: 11,
    subject: "Anglais LV1",
    room: "C12",
    status: "edited",
  },
  { day: 3, from: 13, to: 15, subject: "Français" },
  {
    day: 3,
    from: 15,
    to: 17,
    subject: "Physique-Chimie",
    teacher: "M. Garnier, Mme Lambert",
    status: "evaluated",
    contents: [
      {
        category: "Devoir surveillé",
        title: "Évaluation sur les dosages",
        attachments: [],
      },
      {
        category: "Correction",
        description: "Correction du TP 4 en classe.",
        attachments: [file("Correction TP 4.pdf")],
      },
    ],
  },
  { day: 4, from: 8, to: 9, subject: "Mathématiques" },
  { day: 4, from: 9, to: 11, subject: "Enseignement scientifique" },
  {
    day: 4,
    from: 11,
    to: 12,
    subject: "Espagnol LV2",
    group: "Espagnol LV2 groupe 2",
  },
  { day: 4, from: 14, to: 16, subject: "SVT" },
];

/** Les devoirs de la semaine, à rendre le jour `day` : consigne en HTML, pièces jointes. */
const HOMEWORK: readonly (Omit<Homework, "id" | "givenAt" | "dueAt"> & {
  day: number;
  subject: SubjectName;
})[] = [
  {
    day: 0,
    subject: "Mathématiques",
    content: "<p>Exercices <strong>12 à 15</strong> page 84.</p>",
    done: true,
    attachments: [link("Corrigé en ligne", "https://www.example.com/corrige")],
  },
  {
    day: 1,
    subject: "Français",
    content: "<p>Lire l'acte I du « Malade imaginaire ».</p>",
    done: false,
    attachments: [file("Le Malade imaginaire, acte I.pdf")],
  },
  {
    day: 2,
    subject: "Anglais LV1",
    content:
      "<p>Préparer l'oral sur un lieu de Londres :</p><ul><li>2 minutes au plus</li><li>une image à montrer</li></ul>",
    done: false,
    attachments: [link("Consignes de l'oral", "https://www.example.com/oral")],
  },
  {
    day: 3,
    subject: "Physique-Chimie",
    content: "<p>Finir le compte rendu du TP sur les dosages.</p>",
    done: false,
    attachments: [file("Fiche TP 4.pdf"), file("Tableau de mesures.csv")],
  },
  {
    day: 3,
    subject: "Histoire-Géographie",
    content: "Apprendre la leçon sur l'industrialisation.",
    done: false,
    attachments: [],
  },
  {
    day: 4,
    subject: "SVT",
    content: "<p>Réviser le chapitre 3 pour l'évaluation.</p>",
    done: false,
    attachments: [file("Chapitre 3, résumé.pdf")],
  },
  {
    day: 4,
    subject: "Espagnol LV2",
    content:
      "<p>Rédiger un texte de <strong>150 mots</strong> sur tes dernières vacances, au passé composé et à l'imparfait. Pense à relire les accords et à varier les connecteurs : primero, luego, después, por fin.</p>",
    done: false,
    attachments: [],
  },
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

/**
 * Actualités inventées, publiées `days` jours avant aujourd'hui : accusé demandé, puis déjà
 * envoyé ; sondage ; sans titre ni rubrique ; HTML avec gras, liste et lien ; fichiers et liens.
 */
const NEWS: readonly (Omit<News, "id" | "date"> & { days: number })[] = [
  {
    days: 2,
    kind: "information",
    title: "Sortie pédagogique au musée",
    category: "Histoire-géographie",
    author: "Mme Dubois",
    content:
      "<p>Bonjour à tous,</p><p>Les élèves de 1re G3 visiteront le musée d'Orsay le jeudi 5 novembre. Départ à 8h00 devant le lycée, retour vers 17h30.</p><p>Merci de rapporter l'autorisation signée avant vendredi.</p>",
    read: false,
    needsAcknowledgement: true,
    acknowledged: false,
    attachments: [
      file("Autorisation de sortie.pdf"),
      file("Programme de la visite.pdf"),
    ],
  },
  {
    days: 3,
    kind: "survey",
    title: "Voyage en Espagne",
    category: "Vie scolaire",
    author: "M. Navarro",
    content:
      "<p>Participeras-tu au voyage à Madrid au printemps ?</p><p>Quelle option choisis-tu pour l'hébergement ?</p>",
    read: false,
    needsAcknowledgement: false,
    acknowledged: false,
    attachments: [
      link("Présentation du voyage", "https://www.example.com/madrid"),
      file("Devis hébergement.pdf"),
    ],
  },
  {
    days: 4,
    kind: "information",
    author: "Vie scolaire",
    content:
      '<p>Rappel : les photos de classe auront lieu <strong>jeudi matin</strong> au CDI.</p><ul><li>pense au bon de commande</li><li>une tenue correcte est demandée</li></ul><p>Plus d\'informations sur <a href="https://www.example.com/photos">le site du photographe</a>.</p>',
    read: false,
    needsAcknowledgement: false,
    acknowledged: false,
    attachments: [],
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
    attachments: [],
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
    attachments: [file("Menus de la semaine.jpg")],
  },
  {
    days: 9,
    kind: "information",
    title: "Règlement intérieur 2026-2027",
    category: "Vie scolaire",
    author: "Direction",
    content:
      "<p>Le règlement intérieur a été mis à jour. Merci d'en prendre connaissance.</p>",
    read: true,
    needsAcknowledgement: true,
    acknowledged: true,
    attachments: [file("Règlement intérieur.pdf")],
  },
  {
    days: 13,
    kind: "information",
    title: "Inscriptions à l'association sportive",
    category: "Sport",
    author: "M. Moreau",
    content:
      "<p>Badminton, escalade, futsal : les inscriptions sont ouvertes jusqu'à vendredi.</p>",
    read: true,
    needsAcknowledgement: false,
    acknowledged: false,
    attachments: [
      link("Formulaire d'inscription", "https://www.example.com/as"),
      file("Planning des créneaux.pdf"),
    ],
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
          WEEK.map(({ day, from, to, subject, ...course }): Course => ({
            id: `mock-course-${at(weekStart, day, from).getTime()}`,
            subject,
            from: at(weekStart, day, from),
            to: at(weekStart, day, to),
            ...(isSubject(subject) && SUBJECTS[subject]),
            ...course,
          })),
      },
      HOMEWORK: {
        getHomeworks: async weekStart =>
          HOMEWORK.map(({ day, ...item }, index): Homework => {
            const id = `mock-homework-${at(weekStart, day).getTime()}-${index}`;
            return {
              ...item,
              id,
              givenAt: at(weekStart, day - 7, 8),
              dueAt: at(weekStart, day, 8),
              done: done.get(id) ?? item.done,
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
