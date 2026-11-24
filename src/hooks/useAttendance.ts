// Les absences et retards d'un compte, du plus récent au plus ancien, et les périodes de la vie
// scolaire où ils se rangent. Relus après chaque synchronisation.
import { desc, eq } from "drizzle-orm";

import { db } from "@/database";
import { attendance, attendancePeriods, services } from "@/database/schema";
import type { Attendance, Period } from "@/services/shared/models";

import { Source, useQuery } from "./useQuery";

export interface AttendanceView extends Attendance {
  serviceId: string;
}

export interface AttendancePeriodView extends Period {
  serviceId: string;
}

export interface AttendanceData {
  items: AttendanceView[];
  /** De la plus ancienne à la plus récente. */
  periods: AttendancePeriodView[];
}

async function loadAttendance(accountId: string): Promise<AttendanceData> {
  const own = eq(services.accountId, accountId);
  const [rows, periodRows] = await Promise.all([
    db
      .select({ item: attendance })
      .from(attendance)
      .innerJoin(services, eq(services.id, attendance.serviceId))
      .where(own)
      .orderBy(desc(attendance.from)),
    db
      .select({ period: attendancePeriods })
      .from(attendancePeriods)
      .innerJoin(services, eq(services.id, attendancePeriods.serviceId))
      .where(own)
      .orderBy(attendancePeriods.start),
  ]);
  return {
    items: rows.map(({ item }) => ({
      ...item,
      reason: item.reason ?? undefined,
    })),
    periods: periodRows.map(({ period }) => period),
  };
}

const within = (period: Period, date: Date) =>
  period.start <= date && date <= period.end;

/** La période en cours, sinon la dernière qui a des absences ou des retards, sinon la première. */
export function currentAttendancePeriod(
  { items, periods }: AttendanceData,
  now: Date
): AttendancePeriodView | undefined {
  return (
    periods.find(period => within(period, now)) ??
    [...periods]
      .reverse()
      .find(period =>
        items.some(
          item =>
            item.serviceId === period.serviceId && within(period, item.from)
        )
      ) ??
    periods[0]
  );
}

/** Les absences et retards d'une période, tous sans période. */
export const attendanceOf = (
  items: readonly AttendanceView[],
  period: Period | undefined
) => (period ? items.filter(item => within(period, item.from)) : items);

const EMPTY: AttendanceData = { items: [], periods: [] };

const source = new Source<AttendanceData>("attendance");

export function useAttendance(accountId: string | undefined) {
  return useQuery(source, `${accountId}`, () =>
    accountId ? loadAttendance(accountId) : Promise.resolve(EMPTY)
  );
}
