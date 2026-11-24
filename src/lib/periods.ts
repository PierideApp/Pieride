// La période qu'ouvrent Notes, Assiduité et leurs widgets de l'accueil.
import type { Period } from "@/services/shared/models";

export const within = (period: Period, date: Date) =>
  period.start <= date && date <= period.end;

const length = (period: Period) =>
  period.end.getTime() - period.start.getTime();

/**
 * La période à ouvrir : celle que le service ouvre lui-même, sinon la plus courte des périodes
 * en cours (un trimestre avant « Hors période » ou l'année), sinon la dernière qui a des
 * données, sinon la première.
 */
export function periodToOpen<P extends Period>(
  periods: readonly P[],
  now: Date,
  hasData: (period: P) => boolean
): P | undefined {
  return (
    periods.find(period => period.isDefault) ??
    periods
      .filter(period => within(period, now))
      .sort((a, b) => length(a) - length(b))
      .at(0) ??
    [...periods].reverse().find(hasData) ??
    periods[0]
  );
}
