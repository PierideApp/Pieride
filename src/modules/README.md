# modules

Une page de la barre latérale = un module. Un module s'affiche si l'équipe l'a activé, si un service du compte le fournit et si l'utilisateur ne l'a pas masqué. Les règles complètes sont dans [docs/modules.md](../../docs/modules.md).

- Un dossier par module : `accueil/`, `cours/`, `taches/`, `notes/`, `actualites/`, `assiduite/`. Il contient la page (`notes/NotesPage.tsx`), puis ses composants et ses hooks quand l'écran arrive (M3). Tant qu'il n'a pas d'écran, la page affiche « Bientôt ici ».
- `registry.ts` déclare chaque module avec sa page.
- Ajouter un module = un dossier ici + une ligne dans `registry.ts`.
