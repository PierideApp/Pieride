// Les absences et retards d'un compte, du plus récent au plus ancien. Relus après chaque
// synchronisation.
import { desc, eq } from "drizzle-orm";

import { db } from "@/database";
import { attendance, services } from "@/database/schema";
import type { Attendance } from "@/services/shared/models";

import { Source, useQuery } from "./useQuery";

export interface AttendanceView extends Attendance {
  serviceId: string;
}

async function loadAttendance(accountId: string): Promise<AttendanceView[]> {
  const rows = await db
    .select({ item: attendance })
    .from(attendance)
    .innerJoin(services, eq(services.id, attendance.serviceId))
    .where(eq(services.accountId, accountId))
    .orderBy(desc(attendance.from));
  return rows.map(({ item }) => ({
    ...item,
    reason: item.reason ?? undefined,
  }));
}

const source = new Source<AttendanceView[]>("attendance");

export function useAttendance(accountId: string | undefined) {
  return useQuery(source, `${accountId}`, () =>
    accountId ? loadAttendance(accountId) : Promise.resolve([])
  );
}
