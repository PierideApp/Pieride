import { describe, expect, it } from "vitest";

import { visibleModules } from "@/modules/registry";
import { capabilitiesOf } from "@/services/shared/plugin";

import {
  isPaletteShortcut,
  isSettingsShortcut,
  isSyncShortcut,
  shortcutModule,
} from "./useShortcuts";

const keys = (code: string, modifiers: Partial<KeyboardEvent> = {}) => ({
  code,
  key: "",
  ctrlKey: true,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...modifiers,
});

describe("shortcutModule", () => {
  const modules = visibleModules(capabilitiesOf(["pronote"]));
  const press = (code: string, modifiers?: Partial<KeyboardEvent>) =>
    shortcutModule(keys(code, modifiers), modules)?.id;

  it("suit la touche physique, quel que soit le clavier (AZERTY compris)", () => {
    expect(press("Digit1")).toBe("accueil");
    expect(press("Digit4")).toBe("notes");
    expect(press("Numpad2")).toBe("cours");
  });

  it("accepte ⌘ sur macOS et ignore le reste", () => {
    expect(press("Digit3", { ctrlKey: false, metaKey: true })).toBe("taches");
    expect(press("Digit1", { ctrlKey: false })).toBeUndefined();
    expect(press("Digit1", { altKey: true })).toBeUndefined();
    expect(press("Digit1", { shiftKey: true })).toBeUndefined();
    expect(press("Digit9")).toBeUndefined();
    expect(press("KeyA")).toBeUndefined();
  });
});

describe("isSyncShortcut", () => {
  it("reconnaît Ctrl/⌘ R, mais pas Ctrl Maj R (rechargement forcé)", () => {
    expect(isSyncShortcut(keys("KeyR"))).toBe(true);
    expect(
      isSyncShortcut(keys("KeyR", { ctrlKey: false, metaKey: true }))
    ).toBe(true);
    expect(isSyncShortcut(keys("KeyR", { shiftKey: true }))).toBe(false);
    expect(isSyncShortcut(keys("KeyR", { ctrlKey: false }))).toBe(false);
    expect(isSyncShortcut(keys("KeyT"))).toBe(false);
  });
});

describe("isPaletteShortcut", () => {
  it("reconnaît Ctrl/⌘ K", () => {
    expect(isPaletteShortcut(keys("KeyK"))).toBe(true);
    expect(
      isPaletteShortcut(keys("KeyK", { ctrlKey: false, metaKey: true }))
    ).toBe(true);
    expect(isPaletteShortcut(keys("KeyK", { ctrlKey: false }))).toBe(false);
  });
});

describe("isSettingsShortcut", () => {
  it("reconnaît Ctrl/⌘ , où que soit la virgule sur le clavier", () => {
    expect(isSettingsShortcut(keys("Comma", { key: "," }))).toBe(true);
    // AZERTY : la virgule est sur la touche M du QWERTY.
    expect(isSettingsShortcut(keys("KeyM", { key: "," }))).toBe(true);
    expect(
      isSettingsShortcut(
        keys("Comma", { key: ",", ctrlKey: false, metaKey: true })
      )
    ).toBe(true);
    // AZERTY : la touche Comma du QWERTY donne « ; ».
    expect(isSettingsShortcut(keys("Comma", { key: ";" }))).toBe(false);
    expect(
      isSettingsShortcut(keys("Comma", { key: ",", ctrlKey: false }))
    ).toBe(false);
  });
});
