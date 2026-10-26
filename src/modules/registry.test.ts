import { describe, expect, it } from "vitest";

import { capabilitiesOf } from "@/services/shared/plugin";

import { modulePath, MODULES, visibleModules } from "./registry";

const ids = (kinds: Parameters<typeof capabilitiesOf>[0], hidden?: string[]) =>
  visibleModules(capabilitiesOf(kinds), hidden).map(module => module.id);

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

  it("donne un chemin unique à chaque module", () => {
    const paths = MODULES.map(modulePath);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths[0]).toBe("/");
  });
});
