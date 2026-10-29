// Les pages de la barre latérale (docs/modules.md). Ajouter un module = un dossier
// `src/modules/<id>/` avec sa page, puis une ligne ici.
import {
  Calendar,
  Home,
  Newspaper,
  Pie,
  Tasks,
  UserCross,
} from "@getpapillon/papicons";
import type { ComponentType } from "react";

import type { Capability } from "@/services/shared/plugin";

import { AccueilPage } from "./accueil/AccueilPage";
import { ActualitesPage } from "./actualites/ActualitesPage";
import { AssiduitePage } from "./assiduite/AssiduitePage";
import { CoursPage } from "./cours/CoursPage";
import { NotesPage } from "./notes/NotesPage";
import { countPendingHomework } from "./taches/pending";
import { TachesPage } from "./taches/TachesPage";

export interface ModulePageProps {
  module: ModuleManifest;
}

export interface ModuleManifest {
  /** Sert aussi de clé i18n (`modules.<id>`) et de chemin (`/<id>`, l'accueil étant `/`). */
  id: string;
  icon: typeof Home;
  page: ComponentType<ModulePageProps>;
  /** Le module s'affiche si un service du compte en fournit une. Vide : toujours. */
  requires: readonly Capability[];
  /** `off` : livré mais caché ; `beta` : affiché avec une pastille. */
  status: "stable" | "beta" | "off";
  group: (typeof GROUPS)[number];
  /** Nombre affiché en pastille dans la barre latérale (tâches à faire…), lu dans la base. */
  badge?: (accountId: string) => Promise<number>;
}

/** Les groupes de la barre latérale, dans leur ordre d'affichage. */
const GROUPS = ["main", "school"] as const;

export const MODULES: readonly ModuleManifest[] = [
  {
    id: "accueil",
    icon: Home,
    page: AccueilPage,
    requires: [],
    status: "stable",
    group: "main",
  },
  // Cours ne dépend d'aucun service : les calendriers locaux existent toujours.
  {
    id: "cours",
    icon: Calendar,
    page: CoursPage,
    requires: [],
    status: "stable",
    group: "main",
  },
  {
    id: "taches",
    icon: Tasks,
    page: TachesPage,
    requires: ["HOMEWORK"],
    status: "stable",
    group: "main",
    badge: countPendingHomework,
  },
  {
    id: "notes",
    icon: Pie,
    page: NotesPage,
    requires: ["GRADES"],
    status: "stable",
    group: "main",
  },
  {
    id: "actualites",
    icon: Newspaper,
    page: ActualitesPage,
    requires: ["NEWS"],
    status: "stable",
    group: "school",
  },
  {
    id: "assiduite",
    icon: UserCross,
    page: AssiduitePage,
    requires: ["ATTENDANCE"],
    status: "stable",
    group: "school",
  },
];

export const modulePath = (module: ModuleManifest) =>
  module.id === "accueil" ? "/" : `/${module.id}`;

/**
 * Les modules du compte en cours, groupe par groupe, chacun dans l'ordre choisi par
 * l'utilisateur (`order`), sinon celui du registre. Les raccourcis Ctrl 1 à 9 le suivent.
 */
export function visibleModules(
  capabilities: ReadonlySet<Capability>,
  hidden: readonly string[] = [],
  order: readonly string[] = []
): ModuleManifest[] {
  // Un module absent de `order` (nouveau service lié) se range après les autres.
  const rank = (module: ModuleManifest) => {
    const index = order.indexOf(module.id);
    return index < 0 ? order.length + MODULES.indexOf(module) : index;
  };
  return MODULES.filter(
    module =>
      module.status !== "off" &&
      !hidden.includes(module.id) &&
      (module.requires.length === 0 ||
        module.requires.some(capability => capabilities.has(capability)))
  ).sort(
    (a, b) =>
      GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || rank(a) - rank(b)
  );
}

/**
 * L'ordre des modules après avoir posé `id` à la place de `target`. Un module ne change
 * pas de groupe : sinon, l'ordre ne bouge pas.
 */
export function moveModule(
  modules: readonly ModuleManifest[],
  id: string,
  target: string
): string[] {
  const ids = modules.map(module => module.id);
  const from = modules.find(module => module.id === id);
  const to = modules.find(module => module.id === target);
  if (!from || !to || from.group !== to.group) {
    return ids;
  }
  const rest = ids.filter(other => other !== id);
  rest.splice(ids.indexOf(target), 0, id);
  return rest;
}
