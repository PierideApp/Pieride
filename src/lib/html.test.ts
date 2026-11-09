import { describe, expect, it } from "vitest";

import { newsContentToText } from "./html";

describe("newsContentToText", () => {
  it("supprime les contenus d'actualité qui ne sont que ponctuation", () => {
    expect(newsContentToText(".")).toBe("");
    expect(newsContentToText(" … ")).toBe("");
  });
});
