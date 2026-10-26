# Contribuer à Piéride

Piéride se construit à plusieurs. Signaler un bug, proposer une idée, relire une PR ou écrire du code : tout aide.

## Par où commencer

- Les issues `good first issue` sont faites pour une première contribution.
- Avant de te lancer sur une issue, dis-le en commentaire pour qu'on ne soit pas deux dessus.
- Pour une grosse idée, ouvre d'abord une issue « Idée » : on en discute avant que tu y passes des heures.

## Installer le projet

Prérequis : Node.js 22 ou plus, Rust stable et les [dépendances système de Tauri](https://v2.tauri.app/start/prerequisites/).

```bash
corepack enable pnpm
pnpm install
pnpm tauri dev
```

## De la branche à la fusion

1. Crée une branche depuis `main`, par exemple `feat/vue-semaine` ou `fix/synchro-notes`.
2. Écris tes commits en [Conventional Commits](https://www.conventionalcommits.org/fr/v1.0.0/), sur une ligne : `feat(cours): ajoute la vue semaine`.
3. Vérifie que tout passe :

   ```bash
   pnpm lint
   pnpm format:check
   pnpm typecheck
   pnpm test
   ```

   Si tu as touché au Rust : `cargo fmt` et `cargo clippy` dans `src-tauri/`.

4. Ouvre la PR et remplis le modèle : ce que ça change, comment tester, sur quel système.
5. La CI vérifie le code et compile l'app sur Windows, macOS et Linux. Une relecture suit, puis la fusion.

## Règles d'architecture

- **Une donnée scolaire passe toujours par l'AccountManager.** Un écran n'appelle jamais un service directement.
- **Un nouveau service** = un dossier dans `src/services/` qui implémente `SchoolServicePlugin` et déclare ses `Capabilities`.
- **Un nouveau module** = un dossier dans `src/modules/` et une ligne dans `registry.ts` (voir [docs/modules.md](docs/modules.md)).
- **Base locale** : toute modification du schéma = une nouvelle migration.
- **Rust** : seulement ce que la WebView ne sait pas faire (réseau sans CORS, base SQLite, trousseau, fenêtre de connexion ENT, icône de la barre des tâches).
- **Secrets** : identifiants et jetons uniquement dans le trousseau du système, jamais dans la base, un store ou les journaux.
- **Textes** : tout texte affiché passe par i18next, au moins en français.

Le détail est dans le [schéma d'architecture](docs/architecture.excalidraw).

## Style

Prettier et ESLint décident : 2 espaces, guillemets doubles, imports triés. `pnpm lint --fix` puis `pnpm format` règlent presque tout.

Dans l'interface, on tutoie et on reste simple.

## Une faille de sécurité ?

N'ouvre pas d'issue publique : signale-la en privé depuis l'onglet [Security](https://github.com/PierideApp/Pieride/security/advisories/new) du dépôt.
