import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createDb } from "./client";
import { migrate } from "./migrate";
import { nodeDriver } from "./node-driver";
import {
  accounts,
  courses,
  grades,
  homework,
  periods,
  services,
  subjects,
  syncState,
} from "./schema";

async function freshDatabase() {
  const driver = nodeDriver();
  await migrate(driver);
  return { driver, db: createDb(driver) };
}

describe("migrate", () => {
  it("applique chaque migration une seule fois", async () => {
    const { driver } = await freshDatabase();
    await migrate(driver);
    const applied = await driver.select("SELECT name FROM migrations", []);
    expect(applied).toEqual([["0000_init"], ["0001_parametres"]]);
  });

  it("n'applique rien d'une migration qui échoue", async () => {
    const driver = nodeDriver();
    await expect(
      migrate(driver, {
        "./migrations/0000_casse.sql":
          "CREATE TABLE a (id TEXT); CREATE TABLE (",
      })
    ).rejects.toThrow();
    expect(await driver.select("SELECT name FROM migrations", [])).toEqual([]);
    expect(
      await driver.select("SELECT name FROM sqlite_master WHERE name = 'a'", [])
    ).toEqual([]);
  });

  it("enregistre le nom du fichier tel quel, sans l'exécuter", async () => {
    const driver = nodeDriver();
    const name = "0001_x'); DROP TABLE migrations; --";
    await migrate(driver, { [`./migrations/${name}.sql`]: "SELECT 1" });
    const applied = await driver.select("SELECT name FROM migrations", []);
    expect(applied).toEqual([[name]]);
  });

  it("garde les lignes liées quand une migration reconstruit une table", async () => {
    const { driver, db } = await freshDatabase();
    await db
      .insert(accounts)
      .values({ id: "camille", firstName: "C", lastName: "T" });
    await db
      .insert(services)
      .values({ id: "s1", accountId: "camille", kind: "pronote" });
    // Ce que drizzle-kit écrit pour modifier une colonne de `services`.
    const rebuild = `PRAGMA foreign_keys=OFF;
      CREATE TABLE __new_services (id text PRIMARY KEY NOT NULL, account_id text NOT NULL REFERENCES accounts(id) ON DELETE cascade, kind text NOT NULL, instance_url text, needs_login integer DEFAULT false NOT NULL, created_at integer DEFAULT (unixepoch() * 1000) NOT NULL);
      INSERT INTO __new_services SELECT * FROM services;
      DROP TABLE services;
      ALTER TABLE __new_services RENAME TO services;
      PRAGMA foreign_keys=ON;`;
    await db
      .insert(syncState)
      .values({ serviceId: "s1", capability: "GRADES" });
    await migrate(driver, { "./migrations/0001_rebuild.sql": rebuild });
    expect(await db.select().from(syncState)).toHaveLength(1);
  });

  it("annule une migration qui casse une clé étrangère", async () => {
    const { driver, db } = await freshDatabase();
    await expect(
      migrate(driver, {
        "./migrations/0001_orpheline.sql":
          "INSERT INTO services (id, account_id, kind) VALUES ('s', 'absent', 'pronote')",
      })
    ).rejects.toThrow("clé étrangère");
    expect(await db.select().from(services)).toEqual([]);
  });
});

describe("batch", () => {
  it("n'écrit rien si une requête échoue", async () => {
    const { db } = await freshDatabase();
    const camille = { id: "camille", firstName: "Camille", lastName: "Test" };
    await expect(
      db.batch([
        db.insert(accounts).values(camille),
        db.insert(accounts).values(camille),
      ])
    ).rejects.toThrow();
    expect(await db.select().from(accounts)).toEqual([]);
    await db.insert(accounts).values(camille);
    expect(await db.select().from(accounts)).toHaveLength(1);
  });

  it("refuse une lecture, qui y rendrait un résultat vide", async () => {
    const { db } = await freshDatabase();
    await expect(db.batch([db.select().from(accounts)])).rejects.toThrow(
      "écritures"
    );
  });
});

describe("suppression d'un compte", () => {
  it("chaque table de données dépend de services, en cascade", async () => {
    const { driver } = await freshDatabase();
    const tables = await driver.select(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT IN ('accounts', 'services', 'migrations')",
      []
    );
    expect(tables.length).toBeGreaterThan(0);
    for (const [name] of tables) {
      const keys = await driver.select(
        `SELECT "table", on_delete FROM pragma_foreign_key_list('${String(name)}')`,
        []
      );
      expect(keys, String(name)).toContainEqual(["services", "CASCADE"]);
    }
  });

  it("efface toutes les données du compte, et seulement les siennes", async () => {
    const { db } = await freshDatabase();
    const day = new Date("2026-10-26T08:00:00Z");
    for (const id of ["camille", "sam"]) {
      await db.batch([
        db.insert(accounts).values({ id, firstName: id, lastName: "Test" }),
        db
          .insert(services)
          .values({ id: `${id}-pronote`, accountId: id, kind: "pronote" }),
      ]);
      const serviceId = `${id}-pronote`;
      await db.batch([
        db.insert(syncState).values({ serviceId, capability: "GRADES" }),
        db.insert(subjects).values({ serviceId, name: "Maths" }),
        db
          .insert(periods)
          .values({ serviceId, id: "t1", name: "T1", start: day, end: day }),
        db.insert(courses).values({
          serviceId,
          id: "c1",
          subject: "Maths",
          from: day,
          to: day,
        }),
        db.insert(homework).values({
          serviceId,
          id: "h1",
          subject: "Maths",
          content: "Exercice 3",
          dueAt: day,
          done: false,
          attachments: [],
        }),
        db.insert(grades).values({
          serviceId,
          id: "g1",
          periodId: "t1",
          subject: "Maths",
          title: "Contrôle",
          date: day,
          value: 15,
          outOf: 20,
          coefficient: 1,
          bonus: false,
          optional: false,
        }),
      ]);
    }

    await db.delete(accounts).where(eq(accounts.id, "camille"));

    for (const table of [
      services,
      syncState,
      subjects,
      periods,
      courses,
      homework,
      grades,
    ]) {
      expect(await db.select().from(table)).toHaveLength(1);
    }
    const [grade] = await db.select().from(grades);
    expect(grade).toMatchObject({ serviceId: "sam-pronote", value: 15 });
  });
});
