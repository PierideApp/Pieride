# components

Le kit d'interface (design system) : boutons, cartes, listes, dialogues, champs. Icônes [Papicons](https://github.com/PapillonApp/Papicons), thème clair et sombre.

- **Un dossier par composant** : `Nom/Nom.tsx` et ses styles `Nom/Nom.module.scss`. On l'importe avec `@/components/Nom/Nom`.
- Les composants ne lisent aucune donnée scolaire : ils reçoivent tout par leurs props.
- Couleurs, espacements et rayons : les variables de [`../styles/theme.scss`](../styles/theme.scss), jamais de valeur en dur.

Aujourd'hui :

- **Mise en page** : `Page` (barre d'outils et contenu), `Section` (petit titre et son contenu), `Card` (carte blanche ; `rows` pour une liste de lignes, `tone="success"` en vert), `SettingRow` (une ligne : icône, titre, phrase, contrôle à droite), `SubPageHeader` (retour, titre et action d'une sous-page).
- **Contrôles** : `Button` (secondaire, principal, danger, sans cadre, sur la marque, lien ; taille normale ou grande), `Select` (liste déroulante, à la place de `<select>`), `Switch` (interrupteur), `Segmented` (deux ou trois options côte à côte), `ChoiceCard` (grande carte de choix du premier lancement), `ColorSwatches` (choix d'une couleur), `TextField` (champ et son libellé, dans une carte ou en grand sur la page), `SearchField` (recherche, normale ou en grand), `ActionMenu` (menu « … » d'une ligne).
- **Affichage** : `Avatar` (photo ou initiales d'un compte), `Chip` (petite pastille de texte), `Tip` (encadré d'explication), `InfoCard` (carte d'explication avec un titre), `Notice` (message court dans une carte), `EmptyState` (états vides, introuvables, erreurs), `Spinner` (attente), `ErrorBoundary`.
- **Fenêtres** : `ConfirmDialog` (confirmation avant une action).
