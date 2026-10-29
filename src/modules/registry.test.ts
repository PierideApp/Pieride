import { describe, expect, it } from "vitest";

import { capabilitiesOf } from "@/services/shared/plugin";

import { modulePath, MODULES, moveModule, visibleModules } from "./registry";

const ids = (
  kinds: Parameters<typeof capabilitiesOf>[0],
  hidden?: string[],
  order?: string[]
) =>
  visibleModules(capabilitiesOf(kinds), hidden, order).map(module => module.id);

describe("visibleModules", () => {
  it("n'affiche que Accueil et Cours sans service", () => {
    expect(ids([])).toEqual(["accueil", "cours"]);
  });

  it("suit les services du compte (exemples de docs/modules.md)", () => {
    expect(ids(["pronote", "turboself"])).toEqual([
      "accueil",
      "cours",
      "taches",
      "notes",
      "actualites",
      "assiduite",
    ]);
    expect(ids(["appscho", "izly"])).toEqual([
      "accueil",
      "cours",
      "actualites",
    ]);
  });

  it("retire les modules masqués par l'utilisateur", () => {
    expect(ids(["pronote"], ["notes", "assiduite"])).toEqual([
      "accueil",
      "cours",
      "taches",
      "actualites",
    ]);
  });

  it("suit l'ordre choisi, groupe par groupe", () => {
    // Actualités reste dans Vie scolaire ; Assiduité, absent de l'ordre, se range à la fin.
    expect(
      ids(
        ["pronote"],
        [],
        ["actualites", "notes", "taches", "accueil", "cours"]
      )
    ).toEqual([
      "notes",
      "taches",
      "accueil",
      "cours",
      "actualites",
      "assiduite",
    ]);
  });

  it("donne un chemin unique à chaque module", () => {
    const paths = MODULES.map(modulePath);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths[0]).toBe("/");
  });
});

describe("moveModule", () => {
  const modules = visibleModules(capabilitiesOf(["pronote"]));

  it("pose le module à la place de la cible, vers le haut comme vers le bas", () => {
    expect(moveModule(modules, "notes", "accueil")).toEqual([
      "notes",
      "accueil",
      "cours",
      "taches",
      "actualites",
      "assiduite",
    ]);
    expect(moveModule(modules, "accueil", "taches")).toEqual([
      "cours",
      "taches",
      "accueil",
      "notes",
      "actualites",
      "assiduite",
    ]);
  });

  it("ne change pas un module de groupe", () => {
    expect(moveModule(modules, "actualites", "accueil")).toEqual(
      modules.map(module => module.id)
    );
  });
});
