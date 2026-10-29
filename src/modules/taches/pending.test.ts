import { describe, expect, it } from "vitest";

import { createDb } from "@/database/client";
import { migrate } from "@/database/migrate";
import { nodeDriver } from "@/database/node-driver";
import { accounts, homework, services } from "@/database/schema";

import { countPendingHomework } from "./pending";

// Mercredi 28 octobre 2026, 15 h.
const NOW = new Date(2026, 9, 28, 15);

describe("countPendingHomework", () => {
  it("compte les tâches à faire du compte, à rendre aujourd'hui ou après", async () => {
    const driver = nodeDriver();
    await migrate(driver);
    const db = createDb(driver);
    await db.insert(accounts).values([
      { id: "a", firstName: "Camille", lastName: "Martin" },
      { id: "b", firstName: "Léo", lastName: "Martin" },
    ]);
    await db.insert(services).values([
      { id: "sa", accountId: "a", kind: "mock" },
      { id: "sb", accountId: "b", kind: "mock" },
    ]);
    const task = (
      id: string,
      serviceId: string,
      dueAt: Date,
      done = false
    ) => ({
      id,
      serviceId,
      dueAt,
      done,
      subject: "Maths",
      content: "Exercices",
      attachments: [],
    });
    await db
      .insert(homework)
      .values([
        task("aujourdhui-matin", "sa", new Date(2026, 9, 28, 8)),
        task("demain", "sa", new Date(2026, 9, 29, 8)),
        task("faite", "sa", new Date(2026, 9, 29, 8), true),
        task("hier", "sa", new Date(2026, 9, 27, 8)),
        task("autre-compte", "sb", new Date(2026, 9, 29, 8)),
      ]);

    expect(await countPendingHomework("a", NOW, db)).toBe(2);
    expect(await countPendingHomework("inconnu", NOW, db)).toBe(0);
  });
});
