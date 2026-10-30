# lib

Les briques techniques partagées :

- **Réseau** : toutes les requêtes passent par `tauri-plugin-http`, à cause du CORS de la WebView. Les bibliothèques qui acceptent un _fetcher_ (pawnote, blocksrd, ezly, esup-multi) en reçoivent un ; pour les autres, `globalThis.fetch` est remplacé au démarrage.
- **Trousseau** : identifiants et jetons dans le trousseau du système, via une commande Rust. Jamais dans la base ni dans un store.
- **Journal** (`log.ts`) : messages et requêtes réseau en mémoire seulement, masqués par `redact` (ni jeton, ni URL complète). Affiché dans Paramètres > Développeur. `report` signale une erreur attrapée de la base ou du système (console et journal).
- **Plateforme** (`platform.ts`) : `isMac`, le nom du système et la touche des raccourcis affichée (`⌘` ou `Ctrl`).
- **Images** (`image.ts`) : photo de profil et fond d'écran choisis par l'utilisateur, redimensionnés ou recadrés en URL `data:` JPEG ; la clarté du haut d'un fond d'écran est mesurée pour le voile du bandeau (avec `luminance` et `shadeFor` de `color.ts`).
- **Liens** (`links.ts`) : les adresses ouvertes dans le navigateur (plugin opener), toutes déclarées dans `capabilities/`.
- **Notes de version** (`changelog.ts`) : lit les fichiers Markdown de `changelog/`, un par version (le format est décrit en tête du fichier ; aucun pour l'instant).
- **Matières** (`subjects.ts`) : nom, couleur et emoji affichés (`subjectLook`), avec des valeurs par défaut stables.
- **Semaines** (`week.ts`) : lundi d'une semaine, numéro ISO, jours affichés, jour suivant sans le week-end masqué.
- **Emploi du temps** (`timetable.ts`) : plage horaire de la grille, cours qui se chevauchent côte à côte, pauses entre deux cours.
- **Moyennes** (`grades.ts`) : pondérée, des matières ou médiane, évolution et influence d'une note, sur 20.
- **HTML des services** (`html.ts`) : texte d'une consigne en HTML, pour l'afficher comme du texte, jamais comme du HTML.
- **Recherche** (`search.ts`) : filtrer une liste sans tenir compte des accents ni des majuscules.
