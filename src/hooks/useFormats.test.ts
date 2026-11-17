import { describe, expect, it } from "vitest";

import { relativeParts } from "./useFormats";

const MINUTE = 60_000;

describe("relativeParts", () => {
  it("passe des minutes aux heures puis aux jours", () => {
    expect(relativeParts(-2 * MINUTE)).toEqual([-2, "minute"]);
    expect(relativeParts(-59 * MINUTE)).toEqual([-59, "minute"]);
    expect(relativeParts(-60 * MINUTE)).toEqual([-1, "hour"]);
    expect(relativeParts(-23 * 60 * MINUTE)).toEqual([-23, "hour"]);
    // La capture d'un testeur : « il y a 4 165 minutes ».
    expect(relativeParts(-4165 * MINUTE)).toEqual([-3, "day"]);
  });
});
