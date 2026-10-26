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
  group: "main" | "school";
}

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

/** Les modules du compte en cours, dans l'ordre du registre (raccourcis Ctrl 1 à 6). */
export function visibleModules(
  capabilities: ReadonlySet<Capability>,
  hidden: readonly string[] = []
): ModuleManifest[] {
  return MODULES.filter(
    module =>
      module.status !== "off" &&
      !hidden.includes(module.id) &&
      (module.requires.length === 0 ||
        module.requires.some(capability => capabilities.has(capability)))
  );
}
