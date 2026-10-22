# lib

Les briques techniques partagées :

- **Réseau** : toutes les requêtes passent par `tauri-plugin-http`, à cause du CORS de la WebView. Les bibliothèques qui acceptent un _fetcher_ (pawnote, blocksrd, ezly, esup-multi) en reçoivent un ; pour les autres, `globalThis.fetch` est remplacé au démarrage.
- **Trousseau** : identifiants et jetons dans le trousseau du système, via une commande Rust. Jamais dans la base ni dans un store.
- **Logger** : aucun secret dans les journaux.
