# lib

Les briques techniques partagées :

- **Réseau** : toutes les requêtes passent par `tauri-plugin-http`, à cause du CORS de la WebView. Les bibliothèques qui acceptent un _fetcher_ (pawnote, blocksrd, ezly, esup-multi) en reçoivent un ; pour les autres, `globalThis.fetch` est remplacé au démarrage.
- **Trousseau** : identifiants et jetons dans le trousseau du système, via une commande Rust. Jamais dans la base ni dans un store.
- **Journal** (`log.ts`) : messages et requêtes réseau en mémoire seulement, masqués par `redact` (ni jeton, ni URL complète). Affiché dans Paramètres > Développeur.
- **Plateforme** (`platform.ts`) : `isMac`, le nom du système et la touche des raccourcis affichée (`⌘` ou `Ctrl`).
- **Images** (`image.ts`) : photo de profil et fond d'écran choisis par l'utilisateur, redimensionnés en URL `data:` JPEG.
- **Liens** (`links.ts`) : les adresses ouvertes dans le navigateur (plugin opener), toutes déclarées dans `capabilities/`.
- **Notes de version** (`changelog.ts`) : lit les fichiers Markdown de `changelog/`, un par version (le format est décrit en tête du fichier ; aucun pour l'instant).
- **Matières** (`subjects.ts`) : nom, couleur et emoji affichés, avec des valeurs par défaut stables.
