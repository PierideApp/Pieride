import { describe, expect, it } from "vitest";

import { jumpOf, jumpTo } from "./useJump";

describe("jumpOf", () => {
  it("relit l'élément visé par la palette", () => {
    const jump = { serviceId: "s1", id: "g1", at: 1_760_000_000_000 };
    expect(jumpOf(jumpTo(jump))).toEqual({ ...jump, periodId: undefined });
    expect(jumpOf(jumpTo({ ...jump, periodId: "T1" }))?.periodId).toBe("T1");
  });

  it("ignore un état d'une autre forme", () => {
    expect(jumpOf(null)).toBeUndefined();
    expect(jumpOf("taches")).toBeUndefined();
    expect(jumpOf({ jump: { serviceId: "s1", id: "g1" } })).toBeUndefined();
    expect(jumpOf({ jump: { serviceId: "s1", id: 3, at: 0 } })).toBeUndefined();
  });
});
