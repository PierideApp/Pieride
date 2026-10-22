<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="96" alt="" />
</p>

<h1 align="center">Piéride</h1>

<p align="center">
  Ta vie scolaire sur ordinateur : emploi du temps, notes, devoirs et actualités de PRONOTE, ÉcoleDirecte, Skolengo et plus, réunis dans une application de bureau. Pour Windows, macOS et Linux.
</p>

> [!NOTE]
> Piéride est en cours de développement, il n'y a pas encore de version à télécharger.

## Stack

- [Tauri 2](https://v2.tauri.app) (Rust) + [React](https://react.dev) + TypeScript, avec [Vite](https://vite.dev)
- SQLite + [Drizzle](https://orm.drizzle.team) pour la base locale
- [Zustand](https://zustand.docs.pmnd.rs) pour l'état, [i18next](https://www.i18next.com) pour les traductions
- [pnpm](https://pnpm.io) comme gestionnaire de paquets

## Démarrer

Prérequis : Node.js 22 ou plus, Rust stable et les [dépendances système de Tauri](https://v2.tauri.app/start/prerequisites/).

```bash
corepack enable pnpm
pnpm install
pnpm tauri dev
```

| Commande           | Rôle                                       |
| ------------------ | ------------------------------------------ |
| `pnpm tauri dev`   | Lance l'application en développement       |
| `pnpm tauri build` | Construit l'application et ses installeurs |
| `pnpm lint`        | ESLint                                     |
| `pnpm format`      | Prettier                                   |
| `pnpm typecheck`   | Vérifie les types                          |
| `pnpm test`        | Tests (Vitest)                             |

## Structure

```
src/                    interface + cœur métier (TypeScript)
  app/                  fenêtre, barre latérale, routeur
  modules/              une page = un module
  components/           kit d'interface (design system)
  hooks/                hooks de données (lisent SQLite)
  services/             AccountManager + un dossier par service
  database/             schéma Drizzle, migrations
  stores/               Zustand
  lib/                  réseau, trousseau, logger
  locales/              traductions
src-tauri/              Rust : fenêtre, commandes, permissions, icônes
docs/                   architecture et modules
```

Chaque dossier de `src/` a un README qui explique son rôle.

## Documentation

- [Schéma d'architecture](docs/architecture.excalidraw), à ouvrir sur [excalidraw.com](https://excalidraw.com) : vue d'ensemble, réseau et sécurité, services, modèle de données, feuille de route.
- [Modules](docs/modules.md) : comment la barre latérale s'adapte aux services du compte.
- [Contribuer](CONTRIBUTING.md)

## Remerciements

Piéride s'inspire de [Papillon](https://github.com/PapillonApp/Papillon), avec l'accord de son équipe, et utilise ses icônes [Papicons](https://github.com/PapillonApp/Papicons).

## Licence

[GPL-3.0](LICENSE)
