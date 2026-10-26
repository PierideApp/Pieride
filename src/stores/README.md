# stores

Les stores [Zustand](https://zustand.docs.pmnd.rs). Enregistrés dans le stockage de la WebView :

- `settings.ts` : thème, langue et modules masqués de chaque compte.
- `accounts.ts` : l'`id` du compte affiché.

En mémoire seulement :

- `sync.ts` : synchronisation en cours, échec, version des données (`reload` la change après un compte créé).
- `detail.ts` : contenu du panneau détail.

Les comptes et leurs données sont dans la base SQLite (voir [`../database`](../database) et l'AccountManager), leurs secrets dans le trousseau. Jamais de secret dans un store.
