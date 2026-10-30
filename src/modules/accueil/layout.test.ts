import { describe, expect, it } from "vitest";

import { DEFAULT_HOME_LAYOUT } from "@/stores/settings";

import { dropItem, moveTo, resizeItem, stepSize } from "./layout";

const ids = (layout: readonly { id: string }[]) => layout.map(item => item.id);

describe("moveTo", () => {
  it("déplace un widget à la place d'un autre, dans les deux sens, avec sa taille", () => {
    const moved = moveTo(DEFAULT_HOME_LAYOUT, "grades", 0);
    expect(ids(moved)).toEqual([
      "grades",
      "attendance",
      "news",
      "courses",
      "average",
      "tasks",
    ]);
    expect(moved[0]).toEqual({ id: "grades", size: "normal" });
    expect(ids(moveTo(DEFAULT_HOME_LAYOUT, "attendance", 3))).toEqual([
      "news",
      "courses",
      "average",
      "attendance",
      "tasks",
      "grades",
    ]);
  });

  it("reste dans les bornes", () => {
    expect(ids(moveTo(DEFAULT_HOME_LAYOUT, "news", 99)).at(-1)).toBe("news");
  });
});

describe("tailles", () => {
  it("passe à la taille voisine que propose le widget, sans sortir des bornes", () => {
    expect(stepSize("courses", "normal", 1)).toBe("large");
    expect(stepSize("courses", "compact", -1)).toBe("mini");
    expect(stepSize("courses", "mini", -1)).toBe("mini");
    expect(stepSize("courses", "full", 1)).toBe("full");
    // Assiduité n'a pas de taille « compact » : de la carte, on passe à la normale.
    expect(stepSize("attendance", "mini", 1)).toBe("normal");
  });
});

describe("dropItem", () => {
  it("pose un widget avant ou après un autre de sa zone", () => {
    expect(
      ids(
        dropItem(DEFAULT_HOME_LAYOUT, "grades", {
          kind: "before",
          target: "courses",
        })
      )
    ).toEqual(["attendance", "news", "grades", "courses", "average", "tasks"]);
    expect(
      ids(
        dropItem(DEFAULT_HOME_LAYOUT, "courses", {
          kind: "after",
          target: "tasks",
        })
      )
    ).toEqual(["attendance", "news", "average", "tasks", "courses", "grades"]);
  });

  it("en fait une carte en haut, et lui rend sa taille en redescendant", () => {
    const up = dropItem(DEFAULT_HOME_LAYOUT, "average", {
      kind: "end",
      zone: "strip",
    });
    expect(ids(up).slice(0, 3)).toEqual(["attendance", "news", "average"]);
    expect(up[2]).toEqual({ id: "average", size: "mini", previous: "normal" });
    const down = dropItem(up, "average", { kind: "before", target: "tasks" });
    expect(down.find(item => item.id === "average")).toEqual({
      id: "average",
      size: "normal",
    });
    // Une carte sans taille d'avant prend la normale.
    expect(
      dropItem(DEFAULT_HOME_LAYOUT, "news", { kind: "end", zone: "grid" }).at(
        -1
      )
    ).toEqual({ id: "news", size: "normal" });
  });
});

describe("resizeItem", () => {
  it("retient la taille d'avant en passant en carte", () => {
    const mini = resizeItem(DEFAULT_HOME_LAYOUT, "courses", "mini");
    expect(mini.find(item => item.id === "courses")).toEqual({
      id: "courses",
      size: "mini",
      previous: "normal",
    });
    expect(
      resizeItem(mini, "courses", "large").find(item => item.id === "courses")
    ).toEqual({ id: "courses", size: "large" });
  });
});
