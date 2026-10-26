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
    getGradesForPeriod(period: Period): Promise<Grade[]>;
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
