// Le contrat d'un service. D'après `SchoolServicePlugin` et `Capabilities` de Papillon
// (services/shared/types.ts, GPLv3) : https://github.com/PapillonApp/Papillon
// Différence voulue : une capability n'existe que si ses méthodes sont fournies.
import type {
  Attendance,
  Balance,
  Booking,
  CanteenMenu,
  CanteenTransaction,
  Course,
  Grade,
  Homework,
  LinkedService,
  News,
  Period,
  ServiceKind,
} from "./models";

/** Chaque capability et les méthodes qu'un service doit fournir pour la déclarer (section 4 du schéma). */
export interface CapabilityMethods {
  TIMETABLE: { getWeeklyTimetable(weekStart: Date): Promise<Course[]> };
  HOMEWORK: {
    getHomeworks(weekStart: Date): Promise<Homework[]>;
    setHomeworkCompletion(id: string, done: boolean): Promise<void>;
  };
  GRADES: {
    getGradesPeriods(): Promise<Period[]>;
    /**
     * Les notes de la période, et les matières de son relevé (`subjects`), même celles sans
     * note : la liste des matières (Paramètres > Matières) ne dépend pas que des notes.
     */
    getGradesForPeriod(
      period: Period
    ): Promise<{ grades: Grade[]; subjects: string[] }>;
  };
  NEWS: {
    getNews(): Promise<News[]>;
    setNewsAsAcknowledged(id: string): Promise<void>;
  };
  ATTENDANCE: {
    getAttendancePeriods(): Promise<Period[]>;
    getAttendanceForPeriod(period: Period): Promise<Attendance[]>;
  };
  CANTEEN_MENU: {
    getWeeklyCanteenMenu(weekStart: Date): Promise<CanteenMenu[]>;
  };
  CANTEEN_BALANCE: { getCanteenBalances(): Promise<Balance[]> };
  CANTEEN_HISTORY: {
    getCanteenTransactionsHistory(): Promise<CanteenTransaction[]>;
  };
  CANTEEN_BOOKINGS: {
    getCanteenBookingWeek(weekStart: Date): Promise<Booking[]>;
    setMealAsBooked(id: string, booked: boolean): Promise<void>;
  };
}

export type Capability = keyof CapabilityMethods;

export interface SchoolServicePlugin {
  readonly kind: ServiceKind;
  /** Déclarer une capability, c'est fournir toutes ses méthodes. */
  readonly capabilities: Partial<CapabilityMethods>;
}

/**
 * Connecte un service lié avec son secret (lu dans le trousseau) et renvoie le plugin prêt.
 * `saveSecret` enregistre le nouveau jeton quand le service le renouvelle.
 */
export type ConnectService = (
  service: LinkedService,
  secret: string,
  saveSecret: (secret: string) => Promise<void>
) => Promise<SchoolServicePlugin>;

/**
 * Ce que chaque service fournit, d'après les plugins de Papillon (services/<service>/index.ts),
 * limité aux capabilities reprises. Sert à afficher les modules sans se connecter au service.
 */
export const SERVICE_CAPABILITIES: Record<ServiceKind, readonly Capability[]> =
  {
    pronote: [
      "TIMETABLE",
      "HOMEWORK",
      "GRADES",
      "NEWS",
      "ATTENDANCE",
      "CANTEEN_MENU",
    ],
    ecoledirecte: ["TIMETABLE", "HOMEWORK", "GRADES", "NEWS", "ATTENDANCE"],
    skolengo: ["TIMETABLE", "HOMEWORK", "GRADES", "NEWS", "ATTENDANCE"],
    appscho: ["TIMETABLE", "NEWS"],
    multi: ["TIMETABLE", "NEWS"],
    ical: ["TIMETABLE"],
    turboself: ["CANTEEN_BALANCE", "CANTEEN_HISTORY", "CANTEEN_BOOKINGS"],
    ard: ["CANTEEN_BALANCE", "CANTEEN_HISTORY"],
    izly: ["CANTEEN_BALANCE", "CANTEEN_HISTORY"],
    alise: ["CANTEEN_BALANCE", "CANTEEN_HISTORY"],
    mock: ["TIMETABLE", "HOMEWORK", "GRADES"],
  };

/** Nom affiché de chaque service : un nom de marque, le même dans toutes les langues. */
export const SERVICE_NAMES: Record<ServiceKind, string> = {
  pronote: "PRONOTE",
  ecoledirecte: "ÉcoleDirecte",
  skolengo: "Skolengo",
  appscho: "APPSCHO",
  multi: "ESUP Multi",
  ical: "iCal",
  turboself: "TurboSelf",
  ard: "ARD",
  izly: "Izly",
  alise: "Alise",
  mock: "Mock Data",
};

/** Le rôle de chaque service, pour les ranger dans Paramètres > Comptes liés. */
export const SERVICE_GROUPS: Record<
  ServiceKind,
  "school" | "canteen" | "calendar"
> = {
  pronote: "school",
  ecoledirecte: "school",
  skolengo: "school",
  appscho: "school",
  multi: "school",
  ical: "calendar",
  turboself: "canteen",
  ard: "canteen",
  izly: "canteen",
  alise: "canteen",
  mock: "school",
};

/** Les services sans identifiants : rien à garder dans le trousseau. */
export const NO_SECRET: ReadonlySet<ServiceKind> = new Set(["mock"]);

/** Les capabilities fournies par les services liés à un compte. */
export function capabilitiesOf(kinds: readonly ServiceKind[]): Set<Capability> {
  return new Set(kinds.flatMap(kind => SERVICE_CAPABILITIES[kind]));
}
