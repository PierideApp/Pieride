# components

Le kit d'interface (design system) : boutons, cartes, listes, dialogues, champs. Icônes [Papicons](https://github.com/PapillonApp/Papicons), thème clair et sombre.

- **Un dossier par composant** : `Nom/Nom.tsx` et ses styles `Nom/Nom.module.scss`. On l'importe avec `@/components/Nom/Nom`.
- Les composants ne lisent aucune donnée scolaire : ils reçoivent tout par leurs props.
- Couleurs, espacements et rayons : les variables de [`../styles/theme.scss`](../styles/theme.scss), jamais de valeur en dur.

Aujourd'hui : `Page` (barre d'outils et contenu), `EmptyState` (états vides, introuvables, erreurs), `ErrorBoundary`.
