# stores

Les stores [Zustand](https://zustand.docs.pmnd.rs). Enregistrés dans le stockage de la WebView :

- `settings.ts` : thème, couleur d'accentuation, langue, réglages des modules (Fonctionnalités), barre latérale, démarrage, notifications, et modules masqués et ordre des modules de chaque compte.
- `wallpaper.ts` : fond d'écran de l'accueil (dégradé ou image choisie), à part car l'image pèse quelques centaines de Ko.
- `accounts.ts` : l'`id` du compte affiché, et les services supprimés dont le secret reste à effacer du trousseau (retenté au démarrage).

En mémoire seulement :

- `sync.ts` : synchronisation en cours, échec, version des données (`reload` la change après un compte créé), et le dernier `Ctrl R` (un toutes les 5 minutes au plus).
- `detail.ts` : contenu du panneau détail.

Les comptes et leurs données sont dans la base SQLite (voir [`../database`](../database) et l'AccountManager), leurs secrets dans le trousseau. Jamais de secret dans un store.
