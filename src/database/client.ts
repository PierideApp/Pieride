// Drizzle branché sur la base SQLite, par le plugin sql dans l'app et par `node:sqlite` dans les tests.
import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import { drizzle } from "drizzle-orm/sqlite-proxy";

/** Préchargée par le plugin (tauri.conf.json) : le front n'a pas le droit de `load`. */
export const DATABASE = "sqlite:pieride.db";

export interface SqlQuery {
  sql: string;
  params: unknown[];
}

export interface SqlDriver {
  select(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
  execute(sql: string, params: unknown[]): Promise<void>;
  /** Dans une seule transaction : tout passe, ou rien. */
  batch(queries: SqlQuery[]): Promise<void>;
}

export function pluginDriver(): SqlDriver {
  const database = Database.get(DATABASE);
  return {
    select: (sql, params) => database.select(sql, params),
    execute: async (sql, params) => {
      await database.execute(sql, params);
    },
    // Le plugin n'a pas de transaction : commande Rust `sql_batch` (src-tauri/src/database.rs).
    batch: queries =>
      invoke("sql_batch", {
        queries: queries.map(({ sql, params }) => [sql, params]),
      }),
  };
}

/** Pour plusieurs écritures d'un coup : `db.batch`, jamais `db.transaction` (BEGIN à part, non fiable avec le plugin). */
export function createDb(driver: SqlDriver) {
  return drizzle(
    async (sql, params, method) => {
      if (method === "run") {
        await driver.execute(sql, params);
        return { rows: [] };
      }
      // Le plugin rend des objets dans l'ordre des colonnes ; Drizzle attend des tableaux.
      // ponytail: deux colonnes de même nom (jointure) n'en font qu'une, les nommer avec `as`.
      const rows = (await driver.select(sql, params)).map(Object.values);
      return { rows: method === "get" ? rows[0] : rows };
    },
    async queries => {
      await driver.batch(queries);
      return queries.map(() => ({ rows: [] }));
    }
  );
}

export type Db = ReturnType<typeof createDb>;
