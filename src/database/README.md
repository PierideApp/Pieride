# database

La base locale : SQLite (`tauri-plugin-sql`) avec [Drizzle](https://orm.drizzle.team) en mode `sqlite-proxy`.

- `schema.ts` : le schéma. Chaque table de données porte `service_id` (clé étrangère en cascade) : retirer un compte ou délier un service supprime ses données. Un test le vérifie pour chaque table.
- `migrations/` : le SQL généré par `pnpm db:generate` après un changement de schéma. Ne pas le modifier à la main.
- `migrate.ts` : applique au démarrage les migrations pas encore passées, chacune en un seul appel (tout ou rien). Ajouter un fichier ne demande rien d'autre.
- `client.ts` : Drizzle branché sur le plugin. Pour plusieurs écritures d'un coup, `db.batch`, jamais `db.transaction` (le plugin a plusieurs connexions).
- `node-driver.ts` : la même chose sur `node:sqlite`, pour les tests.

La base est préchargée par le plugin : le front n'a pas le droit d'en ouvrir une autre (`sql:allow-load` refusé). Aucun secret dans la base. Les réglages vont dans [`../stores`](../stores).
