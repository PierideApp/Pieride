// Jours et semaines en heure locale, du lundi au dimanche. `setDate` plutôt que des
// millisecondes : un jour de changement d'heure dure 23 ou 25 heures.

/** Lundi 0 h, heure locale, de la semaine de `date`. */
export function weekStart(date: Date): Date {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

/** Le même moment, `days` jours plus tard (ou plus tôt si négatif). */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Minuit, heure locale, du jour de `date`. */
export function startOfDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

export function sameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/** Numéro de semaine ISO 8601 (« Semaine 42 ») : celle qui contient le premier jeudi de janvier est la 1. */
export function isoWeek(date: Date): number {
  const thursday = addDays(weekStart(date), 3);
  const firstThursday = addDays(
    weekStart(new Date(thursday.getFullYear(), 0, 4)),
    3
  );
  // Arrondi : l'écart compte des jours entiers, même à travers un changement d'heure.
  return (
    Math.round((thursday.getTime() - firstThursday.getTime()) / 604_800_000) + 1
  );
}

/** Les jours affichés de la semaine de `date` : du lundi au vendredi, ou au dimanche. */
export function weekDays(date: Date, weekend: boolean): Date[] {
  const monday = weekStart(date);
  return Array.from({ length: weekend ? 7 : 5 }, (_, i) => addDays(monday, i));
}

const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;

/** Le jour d'après (`1`) ou d'avant (`-1`), en sautant le samedi et le dimanche s'ils sont masqués. */
export function shiftDay(date: Date, step: 1 | -1, weekend: boolean): Date {
  let day = addDays(date, step);
  while (!weekend && isWeekend(day)) {
    day = addDays(day, step);
  }
  return day;
}

/** Le jour ouvert par défaut : aujourd'hui, ou le lundi qui suit si le week-end est masqué. */
export function displayedToday(now: Date, weekend: boolean): Date {
  const today = startOfDay(now);
  return !weekend && isWeekend(today) ? shiftDay(today, 1, false) : today;
}
