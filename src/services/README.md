# services

- `shared/` : modèles communs, `Capabilities`, interface `SchoolServicePlugin`.
- `account-manager.ts` : point d'entrée unique pour les données. Choisit le service selon la capability, se replie sur le cache, gère plusieurs comptes.
- Un dossier par service : `pronote/`, `ecoledirecte/`, `skolengo/`, `appscho/`, `multi/`, `ical/`, `turboself/`, `ard/`, `izly/`, `alise/`.

Ajouter un service = un dossier qui implémente `SchoolServicePlugin` et déclare ses `Capabilities`. Toutes ses requêtes passent par la couche réseau de [`../lib`](../lib).
