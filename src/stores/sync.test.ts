import { describe, expect, it, vi } from "vitest";

import { MANUAL_SYNC_INTERVAL } from "@/services/account-manager";

import { type SyncTarget, useSyncStore } from "./sync";

const { refreshAll, allowAuthRetries } = vi.hoisted(() => ({
  refreshAll: vi.fn(),
  allowAuthRetries: vi.fn(),
}));
vi.mock("@/services", () => ({
  accountManager: { refreshAll, allowAuthRetries },
}));

const camille: SyncTarget = { accountId: "camille", capabilities: ["NEWS"] };
const lou: SyncTarget = { accountId: "lou", capabilities: [] };

const settled = () =>
  vi.waitFor(() => expect(useSyncStore.getState().syncing).toBe(false));

describe("syncNow", () => {
  it("n'accepte qu'un `Ctrl R` toutes les 5 minutes, même quand la synchro échoue", async () => {
    refreshAll.mockRejectedValue(new Error("ServiceUnavailable"));
    const { syncNow } = useSyncStore.getState();
    syncNow(camille, 0);
    await settled();
    syncNow(camille, MANUAL_SYNC_INTERVAL - 1);
    expect(useSyncStore.getState().refusedAt).toBe(MANUAL_SYNC_INTERVAL - 1);
    expect(refreshAll).toHaveBeenCalledOnce();
    // Un `Ctrl R` accepté lève l'attente des connexions, un refusé non.
    expect(allowAuthRetries).toHaveBeenCalledOnce();
    syncNow(camille, MANUAL_SYNC_INTERVAL);
    await settled();
    expect(refreshAll).toHaveBeenCalledTimes(2);
    expect(refreshAll).toHaveBeenLastCalledWith(
      "camille",
      ["NEWS"],
      expect.any(Date),
      MANUAL_SYNC_INTERVAL
    );
  });
});

describe("sync", () => {
  it("synchronise chaque compte, même quand l'un échoue", async () => {
    refreshAll
      .mockReset()
      .mockRejectedValueOnce(new Error("base"))
      .mockResolvedValue(undefined);
    await useSyncStore.getState().sync([camille, lou]);
    expect(refreshAll.mock.calls.map(([id]: unknown[]) => id)).toEqual([
      "camille",
      "lou",
    ]);
    expect(useSyncStore.getState()).toMatchObject({
      syncing: false,
      failed: true,
    });
  });

  it("relance à la fin la synchro demandée pendant une autre", async () => {
    refreshAll.mockReset().mockResolvedValue(undefined);
    const { sync } = useSyncStore.getState();
    const first = sync([camille]);
    void sync([{ accountId: "camille", capabilities: ["GRADES"] }]);
    await first;
    await settled();
    expect(
      refreshAll.mock.calls.map(([, capabilities]: unknown[]) => capabilities)
    ).toEqual([["NEWS"], ["GRADES"]]);
  });
});
