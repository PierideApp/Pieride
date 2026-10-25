# stores

Les stores [Zustand](https://zustand.docs.pmnd.rs), enregistrés dans le stockage de la WebView :

- `settings.ts` : thème et langue.
- `accounts.ts` : l'`id` du compte affiché.

Les comptes et leurs données sont dans la base SQLite (voir [`../database`](../database) et l'AccountManager), leurs secrets dans le trousseau. Jamais de secret dans un store.
