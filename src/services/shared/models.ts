// Modèles communs : la forme unique des données, quel que soit le service.
// D'après les modèles de Papillon (services/shared, GPLv3) :
// https://github.com/PapillonApp/Papillon/tree/main/services/shared
// Simplifiés : pas de lien vers les objets des bibliothèques, rien de l'interface.

export type ServiceKind =
  | "pronote"
  | "ecoledirecte"
  | "skolengo"
  | "appscho"
  | "multi"
  | "ical"
  | "turboself"
  | "ard"
  | "izly"
  | "alise"
  /** Données fictives, en dev seulement (services/mock). */
  | "mock";

/** Une personne. Ses données viennent de ses services liés. */
export interface Account {
  id: string;
  firstName: string;
  lastName: string;
  schoolName?: string;
  className?: string;
  /** Photo de profil, en URL `data:` (lib/image.ts). */
  avatar?: string;
}

/** Un service lié à un compte. Ses secrets sont dans le trousseau, rangés sous `id`. */
export interface LinkedService {
  id: string;
  accountId: string;
  kind: ServiceKind;
  /** Adresse propre au compte (instance PRONOTE, URL iCal…), ouverte au réseau avec `allowInstance`. */
  instanceUrl?: string;
}

export interface Attachment {
  kind: "link" | "file";
  name: string;
  url: string;
}

/** Une matière, telle que l'app l'affiche (nom, couleur et emoji choisis localement). */
export interface Subject {
  /** Le nom donné par le service, qui identifie la matière. */
  name: string;
  displayName?: string;
  color?: string;
  emoji?: string;
}

export interface Period {
  id: string;
  name: string;
  start: Date;
  end: Date;
}

export interface Course {
  /** Unique pour cette séance : un cours qui revient chaque semaine a un id par semaine. */
  id: string;
  subject: string;
  from: Date;
  to: Date;
  room?: string;
  teacher?: string;
  group?: string;
  status?: "canceled" | "edited" | "online" | "evaluated";
  /** Le cahier de textes de la séance, quand le service le fournit. */
  contents?: CourseContent[];
}

/** Ce que l'enseignant a noté pour une séance (cahier de textes). */
export interface CourseContent {
  title?: string;
  /** HTML venant du service (PRONOTE) ou texte simple : à nettoyer avant affichage. */
  description?: string;
  /** « Cours », « Correction »… tel que le service le nomme. */
  category?: string;
  attachments: Attachment[];
}

export interface Homework {
  id: string;
  subject: string;
  /** HTML venant du service (PRONOTE) ou texte simple : à nettoyer avant affichage. */
  content: string;
  givenAt?: Date;
  dueAt: Date;
  done: boolean;
  attachments: Attachment[];
}

export interface Grade {
  id: string;
  subject: string;
  periodId: string;
  title: string;
  date: Date;
  /** Absente quand l'élève n'a pas de note (absent, dispensé…) : voir `status`. */
  value?: number;
  status?: string;
  outOf: number;
  coefficient: number;
  classAverage?: number;
  min?: number;
  max?: number;
  bonus: boolean;
  optional: boolean;
}

/** Moyenne d'une matière sur une période, telle que le service la calcule. */
export interface SubjectAverage {
  subject: string;
  /** Celle de l'élève, de la classe, la plus haute et la plus basse de la classe. */
  student?: number;
  classAverage?: number;
  min?: number;
  max?: number;
  outOf: number;
}

/** Les moyennes d'une période : par matière, et générale si le service la donne. */
export interface PeriodGrades {
  grades: Grade[];
  /** Toutes les matières du relevé, même sans note. */
  averages: SubjectAverage[];
  overall?: { student?: number; classAverage?: number };
}

export interface News {
  id: string;
  title?: string;
  author: string;
  date: Date;
  /** HTML venant du service : à nettoyer avant affichage. */
  content: string;
  read: boolean;
  attachments: Attachment[];
}

/** Une absence ou un retard. */
export interface Attendance {
  id: string;
  kind: "absence" | "delay";
  from: Date;
  to: Date;
  durationMinutes: number;
  reason?: string;
  justified: boolean;
}

export interface Food {
  name: string;
  allergens?: string[];
}

export interface Meal {
  starters?: Food[];
  mains?: Food[];
  sides?: Food[];
  cheeses?: Food[];
  desserts?: Food[];
  drinks?: Food[];
}

export interface CanteenMenu {
  date: Date;
  lunch?: Meal;
  dinner?: Meal;
}

export interface Balance {
  label: string;
  amount: number;
  currency: string;
  mealsRemaining?: number;
}

export interface CanteenTransaction {
  id: string;
  date: Date;
  label: string;
  amount: number;
  currency: string;
}

export interface Booking {
  id: string;
  date: Date;
  label: string;
  canBook: boolean;
  booked: boolean;
}
