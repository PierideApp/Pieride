import { Home } from "@getpapillon/papicons";
import { describe, expect, it } from "vitest";

import { type Command, filterCommands } from "./CommandPalette";

const command = (title: string, subtitle?: string): Command => ({
  id: title,
  group: "goto",
  title,
  subtitle,
  icon: Home,
  run: () => undefined,
});

const commands = [
  command("Accueil"),
  command("Tâches"),
  command("Changer de compte", "Léo Martin · Collège Jean Moulin"),
];
const titles = (query: string) =>
  filterCommands(commands, query).map(found => found.title);

describe("filterCommands", () => {
  it("ignore les accents et la casse", () => {
    expect(titles("taches")).toEqual(["Tâches"]);
    expect(titles("ACCUEIL")).toEqual(["Accueil"]);
  });

  it("cherche chaque mot, aussi dans le sous-titre", () => {
    expect(titles("compte leo")).toEqual(["Changer de compte"]);
    expect(titles("compte paul")).toEqual([]);
  });

  it("garde tout quand la recherche est vide", () => {
    expect(titles("  ")).toHaveLength(3);
  });
});
