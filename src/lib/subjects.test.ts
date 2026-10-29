import { describe, expect, it } from "vitest";

import {
  defaultSubjectColor,
  defaultSubjectEmoji,
  firstGrapheme,
  resolveSubjects,
  SUBJECT_COLORS,
} from "./subjects";

describe("defaultSubjectEmoji", () => {
  it("reconnaît les matières courantes, avec ou sans accents", () => {
    expect(defaultSubjectEmoji("MATHÉMATIQUES")).toBe("📐");
    expect(defaultSubjectEmoji("Histoire-Géographie")).toBe("🌍");
    expect(defaultSubjectEmoji("Français")).toBe("📘");
    expect(defaultSubjectEmoji("Anglais LV1")).toBe("💬");
    expect(defaultSubjectEmoji("Sciences économiques & sociales")).toBe("📊");
    expect(defaultSubjectEmoji("ED.PHYSIQUE & SPORT.")).toBe("🤸");
    expect(defaultSubjectEmoji("Physique-Chimie")).toBe("🧪");
    expect(defaultSubjectEmoji("EPS")).toBe("🤸");
  });

  it("donne un livre à une matière inconnue", () => {
    expect(defaultSubjectEmoji("Vie de classe")).toBe("📚");
  });
});

describe("defaultSubjectColor", () => {
  it("donne toujours la même couleur de la palette à un même nom", () => {
    const color = defaultSubjectColor("Mathématiques");
    expect(SUBJECT_COLORS).toContain(color);
    expect(defaultSubjectColor("Mathématiques")).toBe(color);
    expect(defaultSubjectColor("MATHEMATIQUES")).toBe(color);
  });
});

describe("firstGrapheme", () => {
  it("garde un emoji entier, même composé", () => {
    expect(firstGrapheme("🧑‍🏫 prof")).toBe("🧑‍🏫");
    expect(firstGrapheme("  ✏️")).toBe("✏️");
    expect(firstGrapheme("")).toBe("");
  });
});

describe("resolveSubjects", () => {
  it("fusionne une matière de plusieurs services et garde le choix de l'élève", () => {
    const views = resolveSubjects(
      [
        { name: "SVT", displayName: null, color: null, emoji: null },
        { name: "Maths", displayName: null, color: null, emoji: null },
        {
          name: "Maths",
          displayName: "Algèbre",
          color: "#3a56d0",
          emoji: "🧮",
        },
      ],
      [
        { subject: "Maths", teacher: null },
        { subject: "Maths", teacher: "M. Bernard" },
        { subject: "Maths", teacher: "Mme Ancienne" },
      ],
      "fr"
    );
    expect(views).toEqual([
      {
        name: "Maths",
        label: "Algèbre",
        color: "#3a56d0",
        emoji: "🧮",
        customized: true,
        teacher: "M. Bernard",
      },
      {
        name: "SVT",
        label: "SVT",
        color: defaultSubjectColor("SVT"),
        emoji: "🧬",
        customized: false,
        teacher: undefined,
      },
    ]);
  });
});
