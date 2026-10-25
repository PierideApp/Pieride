// Applique au démarrage les migrations générées par `pnpm db:generate`, dans l'ordre,
// une seule fois chacune. Vite embarque les fichiers : en ajouter un ne demande rien d'autre.
import type { SqlDriver } from "./client";

const FILES = import.meta.glob<string>("./migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
});

export async function migrate(driver: SqlDriver, files = FILES): Promise<void> {
  await driver.execute(
    "CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)",
    []
  );
  const applied = new Set(
    (await driver.select("SELECT name FROM migrations", [])).map(row =>
      String(row.name)
    )
  );
  const pending = Object.entries(files)
    .map(([path, sql]) => ({ name: path.replace(/^.*\/|\.sql$/g, ""), sql }))
    .filter(({ name }) => !applied.has(name))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const { name, sql } of pending) {
    // La migration et son enregistrement passent ensemble, ou pas du tout.
    await driver.batch([
      { sql, params: [] },
      {
        sql: "INSERT INTO migrations VALUES (?, unixepoch())",
        params: [name],
      },
    ]);
  }
}
