import { describe, expect, it } from "vitest";

import {
  CHANGELOG_FILES,
  compareVersions,
  isReleaseFile,
  parseInline,
  parseNotes,
  parseRelease,
  releases,
} from "./changelog";

const file = (version: string, title = "", body = "") =>
  `---\nversion: ${version}\ndate: 2026-10-14\ntitle: ${title}\n---\n\n${body}`;

describe("parseRelease", () => {
  it("lit l'en-tête et garde les notes", () => {
    expect(
      parseRelease(
        "changelog/v0.2.0.md",
        file("v0.2.0", "Vue semaine", "### Ajouts\n\n- Une chose\n")
      )
    ).toEqual({
      version: "0.2.0",
      date: "2026-10-14",
      title: "Vue semaine",
      body: "### Ajouts\n\n- Une chose",
    });
  });

  it("nomme le fichier quand l'en-tête est faux", () => {
    expect(() => parseRelease("0.2.0.md", "### Ajouts")).toThrow(
      /0\.2\.0\.md : .*en-tête/
    );
    expect(() => parseRelease("0.2.0.md", file("0.3.0"))).toThrow(
      /nom du fichier/
    );
    expect(() =>
      parseRelease("0.2.0.md", "---\nversion: 0.2.0\ndate: 14/10/2026\n---\n")
    ).toThrow(/date/);
  });
});

describe("compareVersions", () => {
  it("suit l'ordre des versions, préversions avant la version", () => {
    const sorted = [
      "0.10.0",
      "0.1.0",
      "0.1.0-alpha.2",
      "0.2.0",
      "0.1.0-alpha.10",
      "0.1.0-beta.1",
    ].sort(compareVersions);
    expect(sorted).toEqual([
      "0.1.0-alpha.2",
      "0.1.0-alpha.10",
      "0.1.0-beta.1",
      "0.1.0",
      "0.2.0",
      "0.10.0",
    ]);
  });
});

describe("parseNotes", () => {
  it("découpe titres, listes et paragraphes, lignes continuées comprises", () => {
    expect(
      parseNotes(
        "Un paragraphe\nsur deux lignes.\n\n### Ajouts\n\n- **Un** point\n  qui continue.\n- Un autre."
      )
    ).toEqual([
      { kind: "paragraph", text: "Un paragraphe sur deux lignes." },
      { kind: "heading", text: "Ajouts" },
      { kind: "list", items: ["**Un** point qui continue.", "Un autre."] },
    ]);
  });
});

describe("parseInline", () => {
  it("repère le gras et le code", () => {
    expect(parseInline("**Palette.** `Ctrl K` pour tout.")).toEqual([
      { kind: "strong", text: "Palette." },
      { kind: "text", text: " " },
      { kind: "code", text: "Ctrl K" },
      { kind: "text", text: " pour tout." },
    ]);
  });
});

describe("releases", () => {
  const files = {
    "../../changelog/0.1.0.md": file("0.1.0", "Première"),
    "../../changelog/0.2.0.md": file("0.2.0", "Deuxième"),
    "../../changelog/en/0.2.0.md": file("0.2.0", "Second"),
    "../../changelog/README.md": "# Notes de version",
  };

  it("donne la traduction quand elle existe, sinon le français, du plus récent au plus ancien", () => {
    expect(releases("en", files).map(({ title }) => title)).toEqual([
      "Second",
      "Première",
    ]);
    expect(releases("fr", files).map(({ title }) => title)).toEqual([
      "Deuxième",
      "Première",
    ]);
  });
});

describe("les fichiers de changelog/", () => {
  const names = Object.keys(CHANGELOG_FILES).filter(isReleaseFile);

  it("ont tous un en-tête valide", () => {
    for (const name of names) {
      expect(() =>
        parseRelease(name, CHANGELOG_FILES[name] ?? "")
      ).not.toThrow();
    }
  });

  it("ne traduisent que des versions qui existent en français", () => {
    const french = new Set(
      names
        .filter(name => !/changelog\/[a-z]{2}\//.test(name))
        .map(name => name.replace(/^.*\//, ""))
    );
    for (const name of names.filter(name =>
      /changelog\/[a-z]{2}\//.test(name)
    )) {
      expect(french).toContain(name.replace(/^.*\//, ""));
    }
  });
});
