import { describe, expect, it, vi } from "vitest";

import { MANUAL_SYNC_INTERVAL } from "@/services/account-manager";

import { useSyncStore } from "./sync";

const { refreshAll } = vi.hoisted(() => ({ refreshAll: vi.fn() }));
vi.mock("@/services", () => ({ accountManager: { refreshAll } }));

const settled = () =>
  vi.waitFor(() => expect(useSyncStore.getState().syncing).toBe(false));

describe("syncNow", () => {
  it("n'accepte qu'un `Ctrl R` toutes les 5 minutes, même quand la synchro échoue", async () => {
    refreshAll.mockRejectedValue(new Error("ServiceUnavailable"));
    const { syncNow } = useSyncStore.getState();
    syncNow("camille", 0);
    await settled();
    syncNow("camille", MANUAL_SYNC_INTERVAL - 1);
    expect(useSyncStore.getState().refusedAt).toBe(MANUAL_SYNC_INTERVAL - 1);
    expect(refreshAll).toHaveBeenCalledOnce();
    syncNow("camille", MANUAL_SYNC_INTERVAL);
    await settled();
    expect(refreshAll).toHaveBeenCalledTimes(2);
    expect(refreshAll).toHaveBeenLastCalledWith(
      "camille",
      expect.any(Date),
      MANUAL_SYNC_INTERVAL
    );
  });
});
