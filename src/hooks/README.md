# hooks

Les hooks de données (`useTimetable`, `useGrades`, `useHomework`...). Ils lisent la base locale, donc les écrans marchent aussi hors ligne.

Un écran n'appelle jamais un service directement : il passe par ces hooks.
