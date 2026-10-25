// Pilote `node:sqlite` (inclus dans Node 22) pour les tests : une base en mémoire, avec les
// mêmes règles que l'app (clés étrangères actives, `batch` tout ou rien comme `sql_batch`).
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
  const execute = async (sql: string, params: unknown[]) => {
    if (params.length === 0) {
      database.exec(sql);
    } else {
      database.prepare(sql).run(...params.map(toSqlValue));
    }
  };
  return {
    select: async (sql, params) =>
      database.prepare(sql).all(...params.map(toSqlValue)),
    execute,
    batch: async queries => {
      database.exec("BEGIN");
      try {
        for (const { sql, params } of queries) {
          await execute(sql, params);
        }
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
      database.exec("COMMIT");
    },
  };
}
