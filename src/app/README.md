# app

La coquille de l'application.

- `App.tsx` : la racine (thème, routeur). Sans compte, elle affiche le premier lancement à la place du cadre.
- `tray.ts` : icône dans la barre des tâches, menu Ouvrir / Quitter traduit par i18next.
- `layout/` : tout le cadre de la fenêtre, au même endroit.
  - `Layout.tsx` : barre latérale, boutons de la fenêtre, routes des modules visibles.
  - `Sidebar.tsx` : compte, liens des modules, état de la synchronisation ; rail d'icônes sous 1280 px.
  - `WindowControls.tsx` : réduire, agrandir, fermer sous Windows et Linux (la fenêtre n'a pas de décorations).
  - `NotFound.tsx` : adresse inconnue ou module caché pour le compte.
  - `CommandPalette.tsx` : palette de commandes (`Ctrl/⌘ K`) : aller à un module, ouvrir une tâche, une note, un cours ou une actualité déjà en base (`paletteSearch.ts`), une section des Paramètres, synchroniser, changer de compte.
  - `DetailPanel.tsx` : panneau détail à droite, ouvert par une page via `stores/detail.ts`.
  - `layout.module.scss` : les styles de tout le cadre.
- `onboarding/` : le premier lancement (maquettes `01-premier-lancement`). `Onboarding.tsx` mène les étapes : `Welcome`, `ProfileStep` (qui es-tu ?), `ServiceStep`, `OfflineAccountStep`. Seul le compte hors ligne se crée pour l'instant.
- `settings/` : les Paramètres en plein écran (`Ctrl/⌘ ,`), catégories à gauche, `Échap` pour fermer.
  - `Settings.tsx` : la superposition et la liste des catégories. Une catégorie sans page affiche « Bientôt ici ».
  - `AppearanceSettings.tsx` (thème), `SidebarSettings.tsx` (modules affichés pour le compte en cours), `LanguageSettings.tsx`, `DeveloperSettings.tsx` (données fictives, en dev seulement).
  - `settings.module.scss` : leurs styles.

La barre latérale et les routes sont construites à partir des modules visibles du compte en cours (voir [`../modules`](../modules)).
