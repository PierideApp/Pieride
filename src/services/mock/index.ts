// Données fictives pour travailler sur les écrans sans compte scolaire (Paramètres >
// Développeur). En dev seulement : l'app publiée ne contient pas ce fichier (services/index.ts).
// Aucun réseau : tout est calculé à partir de la semaine demandée. Élève, professeurs et
// établissement sont inventés, comme sur les maquettes (Camille Martin, 1re G3).
import type { Course, Grade, Homework, Period } from "../shared/models";
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

/** Le faux service. `now` sert aux notes : seules celles déjà passées existent. */
export function mockPlugin(now = () => new Date()): SchoolServicePlugin {
  // Cocher un devoir dure le temps de la session, comme une réponse du service.
  const done = new Map<string, boolean>();

  return {
    kind: "mock",
    capabilities: {
      TIMETABLE: {
        getWeeklyTimetable: async weekStart =>
          WEEK.map(([day, from, to, subject, status]) => ({
            id: `mock-course-${at(weekStart, day, from).getTime()}`,
            subject,
            from: at(weekStart, day, from),
            to: at(weekStart, day, to),
            ...SUBJECTS[subject],
            status,
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
        getGradesForPeriod: async period =>
          GRADES.map(
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
          ).filter(grade => grade.date <= now()),
      },
    },
  };
}

export const connectMock: ConnectService = async () => mockPlugin();
