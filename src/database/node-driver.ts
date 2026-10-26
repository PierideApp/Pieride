// Pilote `node:sqlite` (inclus dans Node 22) pour les tests : une base en mémoire, avec les
// mêmes règles que les commandes Rust (clés étrangères actives, `batch` tout ou rien,
// migrations clés étrangères coupées puis vérifiées).
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

import type { SqlDriver } from "./client";

function toSqlValue(value: unknown): SQLInputValue {
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "string" ||
    value instanceof Uint8Array
  ) {
    return value;
  }
  throw new TypeError(`Paramètre SQL non pris en charge : ${typeof value}`);
}

export function nodeDriver(): SqlDriver {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  // Sans paramètre, `exec` accepte plusieurs requêtes (fichiers de migration), comme sqlx.
  const run = (sql: string, params: unknown[]) => {
    if (params.length === 0) {
      database.exec(sql);
    } else {
      database.prepare(sql).run(...params.map(toSqlValue));
    }
  };
  const transaction = (work: () => void) => {
    database.exec("BEGIN");
    try {
      work();
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
    database.exec("COMMIT");
  };
  return {
    select: async (sql, params) =>
      database
        .prepare(sql)
        .all(...params.map(toSqlValue))
        .map(row => Object.values(row)),
    execute: async (sql, params) => run(sql, params),
    batch: async queries =>
      transaction(() => queries.forEach(({ sql, params }) => run(sql, params))),
    applyMigration: async (name, sql) => {
      database.exec("PRAGMA foreign_keys = OFF");
      try {
        transaction(() => {
          database.exec(sql);
          if (database.prepare("PRAGMA foreign_key_check").all().length > 0) {
            throw new Error(`La migration ${name} casse une clé étrangère`);
          }
          run("INSERT INTO migrations VALUES (?, unixepoch())", [name]);
        });
      } finally {
        database.exec("PRAGMA foreign_keys = ON");
      }
    },
  };
}
