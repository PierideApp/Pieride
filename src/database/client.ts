// Drizzle branché sur la base SQLite : commandes Rust `db_*` dans l'app
// (src-tauri/src/database.rs), `node:sqlite` dans les tests.
import { invoke } from "@tauri-apps/api/core";
import { drizzle } from "drizzle-orm/sqlite-proxy";

export interface SqlQuery {
  sql: string;
  params: unknown[];
}

export interface SqlDriver {
  /** Chaque ligne en tableau, dans l'ordre des colonnes. */
  select(sql: string, params: unknown[]): Promise<unknown[][]>;
  execute(sql: string, params: unknown[]): Promise<void>;
  /** Dans une seule transaction : tout passe, ou rien. */
  batch(queries: SqlQuery[]): Promise<void>;
  /** Applique une migration et l'enregistre, clés étrangères coupées le temps de la migration. */
  applyMigration(name: string, sql: string): Promise<void>;
}

export const tauriDriver: SqlDriver = {
  select: (sql, params) => invoke("db_select", { sql, params }),
  execute: (sql, params) => invoke("db_execute", { sql, params }),
  batch: queries =>
    invoke("db_batch", {
      queries: queries.map(({ sql, params }) => [sql, params]),
    }),
  applyMigration: (name, sql) => invoke("db_apply_migration", { name, sql }),
};

/** Pour plusieurs écritures d'un coup : `db.batch`, jamais `db.transaction` (BEGIN à part, sur une connexion quelconque). */
export function createDb(driver: SqlDriver) {
  return drizzle(
    async (sql, params, method) => {
      if (method === "run") {
        await driver.execute(sql, params);
        return { rows: [] };
      }
      const rows = await driver.select(sql, params);
      return { rows: method === "get" ? rows[0] : rows };
    },
    async queries => {
      if (queries.some(({ method }) => method !== "run")) {
        throw new Error(
          "db.batch ne sert qu'aux écritures : une lecture y rendrait un résultat vide"
        );
      }
      await driver.batch(queries);
      return queries.map(() => ({ rows: [] }));
    }
  );
}

export type Db = ReturnType<typeof createDb>;
