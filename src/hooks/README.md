# hooks

Les hooks partagés.

- **Données** : `useAccounts`, `useLastSync`, puis `useTimetable`, `useGrades`, `useHomework`... Ils lisent la base locale avec `useLoaded` (chargement, erreur, données, relecture après chaque synchronisation), donc les écrans marchent aussi hors ligne.
- **Interface** : `useTheme` (thème clair, sombre ou système), `useShortcuts` (`Ctrl/⌘ 1` à `9` pour les modules, `Ctrl/⌘ R` pour synchroniser, `Ctrl/⌘ K` pour la palette, `Ctrl/⌘ ,` pour les Paramètres) et `useModalDialog` (ouvre un `<dialog>` modal : palette, Paramètres).

Un écran n'appelle jamais un service directement : il passe par ces hooks.
