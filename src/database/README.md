# database

La base locale : SQLite (`tauri-plugin-sql`) avec [Drizzle](https://orm.drizzle.team) en mode `sqlite-proxy`.

- Le schéma est écrit en TypeScript ici.
- Les migrations sont générées par `drizzle-kit` dans `migrations/` et appliquées au démarrage.
- Toute modification du schéma = une nouvelle migration numérotée.

Le modèle de données est décrit dans la section 5 de [docs/architecture.excalidraw](../../docs/architecture.excalidraw). Les réglages ne vont pas dans la base, ils vont dans [`../stores`](../stores).
