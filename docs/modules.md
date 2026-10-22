# Modules

Chaque page de la barre latérale est un **module**. Un module s'affiche seulement si trois conditions sont réunies :

1. **L'équipe l'a activé.** Chaque module a un statut fixé dans le code : `stable`, `beta` ou `off`. Un module `off` n'existe pas pour l'utilisateur, ce qui permet de livrer une page en préparation sans la montrer.
2. **Un service du compte sait le fournir.** Le module déclare les capabilities dont il a besoin. Il apparaît si au moins un service lié au compte en cours en déclare une.
3. **L'utilisateur ne l'a pas masqué.** Dans Paramètres > Barre latérale, pour chaque compte, comme `disabledTabsByAccount` dans Papillon.

Un **compte** est une personne avec ses services liés : par exemple PRONOTE + TurboSelf pour Camille. La barre latérale change donc quand on change de compte.

## Les modules

| Module     | Capabilities nécessaires (une suffit) | Fourni par                                                                     | Statut                              |
| ---------- | ------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------- |
| Accueil    | aucune                                | toujours                                                                       | stable                              |
| Cours      | `TIMETABLE`, ou un calendrier         | PRONOTE, ÉcoleDirecte, Skolengo, APPSCHO, ESUP Multi, iCal, calendriers locaux | stable                              |
| Tâches     | `HOMEWORK`                            | PRONOTE, ÉcoleDirecte, Skolengo                                                | stable                              |
| Notes      | `GRADES`                              | PRONOTE, ÉcoleDirecte, Skolengo                                                | stable                              |
| Actualités | `NEWS`                                | PRONOTE, ÉcoleDirecte, Skolengo, APPSCHO, ESUP Multi                           | stable                              |
| Assiduité  | `ATTENDANCE`                          | PRONOTE, ÉcoleDirecte, Skolengo                                                | stable                              |
| Messagerie | `CHAT_READ`                           | PRONOTE, Skolengo                                                              | **off** (pas d'écran dans Papillon) |

Comme « Mes événements » existe toujours, Cours est en pratique toujours disponible, y compris pour un compte hors ligne.

**La cantine n'est pas un module.** Les capabilities `CANTEEN_*` (TurboSelf, ARD, Izly, Alise) et `CANTEEN_MENU` (PRONOTE) alimentent des éléments d'autres modules : la pause méridienne dans Cours, le raccourci et la fenêtre « Réserver la semaine » sur l'Accueil. Ces éléments suivent la même règle : ils n'apparaissent que si un service du compte les fournit.

## Exemples

| Compte            | Services liés       | Barre latérale                                                          |
| ----------------- | ------------------- | ----------------------------------------------------------------------- |
| Camille, lycéenne | PRONOTE + TurboSelf | Accueil, Cours, Tâches, Notes, Actualités, Assiduité ; repas dans Cours |
| Étudiant          | APPSCHO + Izly      | Accueil, Cours, Actualités ; solde Izly sur l'Accueil                   |
| Compte hors ligne | aucun               | Accueil, Cours (événements et calendriers iCal)                         |

## Dans le code

Un simple tableau de modules, pas de système de plugins ni de chargement dynamique :

```ts
// src/modules/registry.ts
export const MODULES: ModuleManifest[] = [
  {
    id: "accueil",
    label: "Accueil",
    icon: "Home",
    route: "/",
    requires: [],
    status: "stable",
  },
  {
    id: "notes",
    label: "Notes",
    icon: "Pie",
    route: "/notes",
    requires: [Capabilities.GRADES],
    status: "stable",
  },
  {
    id: "messagerie",
    label: "Messagerie",
    icon: "TextBubble",
    route: "/messagerie",
    requires: [Capabilities.CHAT_READ],
    status: "off",
  },
  // …
];

// Modules affichés pour le compte en cours
export const visibleModules = (account: Account, hidden: string[]) =>
  MODULES.filter(
    m =>
      m.status !== "off" &&
      !hidden.includes(m.id) &&
      (m.requires.length === 0 ||
        m.requires.some(c => accountHasCapability(account, c)))
  );
```

- Chaque module vit dans son dossier `src/modules/<id>/` : sa page, ses composants, ses hooks.
- Le routeur ne déclare que les routes des modules visibles. Une adresse vers un module caché affiche l'état « Page introuvable ».
- Les raccourcis `Ctrl/⌘ 1` à `6` suivent l'ordre des modules visibles.
- Un module `beta` s'affiche avec une pastille « Bêta » dans la barre latérale.
- Ajouter un module = un dossier dans `src/modules/` + une ligne dans `MODULES`.
