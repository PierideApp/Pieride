import { describe, expect, it } from "vitest";

import { newsContentToHtml } from "./html";

describe("newsContentToHtml", () => {
  it("supprime les contenus d'actualité qui ne sont que ponctuation", () => {
    expect(newsContentToHtml(".")).toBe("");
    expect(newsContentToHtml(" … ")).toBe("");
  });

  it("garde une actualité qui contient seulement une image", () => {
    const image = '<img src="data:image/png;base64,aGVsbG8=">';
    expect(newsContentToHtml(image)).toBe(image);
  });
});
