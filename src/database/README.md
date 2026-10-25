# database

La base locale : SQLite, ouverte côté Rust avec sqlx (`src-tauri/src/database.rs`), et [Drizzle](https://orm.drizzle.team) en mode `sqlite-proxy` côté front. Le fichier `pieride.db` est dans le dossier de données de l'app.

- `schema.ts` : le schéma. Chaque table de données porte `service_id` (clé étrangère en cascade) : retirer un compte ou délier un service supprime ses données. Un test le vérifie pour chaque table.
- `migrations/` : le SQL généré par `pnpm db:generate` après un changement de schéma. Ne pas le modifier à la main.
- `migrate.ts` : applique au démarrage les migrations pas encore passées. Chacune tourne clés étrangères coupées (drizzle-kit reconstruit des tables en les supprimant), dans une transaction vérifiée avant validation. Ajouter un fichier ne demande rien d'autre.
- `client.ts` : Drizzle branché sur les commandes Rust `db_*`. Pour plusieurs écritures d'un coup, `db.batch` (vraie transaction), jamais `db.transaction`.
- `node-driver.ts` : les mêmes règles sur `node:sqlite`, pour les tests.

Chaque connexion refuse `ATTACH` (et donc `VACUUM INTO`) : le front ne peut ni lire ni créer d'autre fichier que cette base. Aucun secret dans la base. Les réglages vont dans [`../stores`](../stores).
