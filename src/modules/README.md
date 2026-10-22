# modules

Une page de la barre latérale = un module. Un module s'affiche si l'équipe l'a activé, si un service du compte le fournit et si l'utilisateur ne l'a pas masqué. Les règles complètes sont dans [docs/modules.md](../../docs/modules.md).

- Un dossier par module : `accueil/`, `cours/`, `taches/`, `notes/`, `actualites/`, `assiduite/`.
- Chaque module est déclaré dans `registry.ts`.
- Ajouter un module = un dossier ici + une ligne dans `registry.ts`.
