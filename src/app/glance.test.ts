import { describe, expect, it } from "vitest";

import { createDb } from "@/database/client";
import { migrate } from "@/database/migrate";
import { nodeDriver } from "@/database/node-driver";
import { accounts, courses, services, subjects } from "@/database/schema";

import { glanceCourses } from "./glance";

// Mercredi 28 octobre 2026, 10 h 30.
const NOW = new Date(2026, 9, 28, 10, 30);
const at = (day: number, hour: number) => new Date(2026, 9, day, hour);

describe("glanceCourses", () => {
  it("trouve le cours en cours et le suivant du jour, sans les annulés", async () => {
    const driver = nodeDriver();
    await migrate(driver);
    const db = createDb(driver);
    await db
      .insert(accounts)
      .values({ id: "a", firstName: "Camille", lastName: "Martin" });
    await db.insert(services).values({ id: "s", accountId: "a", kind: "mock" });
    await db
      .insert(subjects)
      .values({ serviceId: "s", name: "MATHS", displayName: "Maths" });
    const course = (
      id: string,
      subject: string,
      from: Date,
      to: Date,
      status?: "canceled"
    ) => ({ serviceId: "s", id, subject, from, to, status });
    await db
      .insert(courses)
      .values([
        course("passe", "SVT", at(28, 8), at(28, 9)),
        course("en-cours", "MATHS", at(28, 10), at(28, 11)),
        course("annule", "EPS", at(28, 11), at(28, 12), "canceled"),
        course("suivant", "Anglais", at(28, 14), at(28, 15)),
        course("demain", "SVT", at(29, 8), at(29, 9)),
      ]);

    const glance = await glanceCourses("a", NOW, db);
    expect(glance.current?.subject).toBe("Maths");
    expect(glance.next?.subject).toBe("Anglais");

    const evening = await glanceCourses("a", at(28, 18), db);
    expect(evening).toEqual({ current: undefined, next: undefined });
  });
});
