import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUpdateStore } from "./update";

const { check, invoke, closeLogins, reopenLogins } = vi.hoisted(() => ({
  check: vi.fn(),
  invoke: vi.fn(),
  closeLogins: vi.fn(),
  reopenLogins: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-updater", () => ({ check }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@/lib/log", () => ({ report: vi.fn() }));
vi.mock("@/services/shared/auth", () => ({ closeLogins, reopenLogins }));

const state = () => useUpdateStore.getState().state;

beforeEach(() => {
  useUpdateStore.setState({ state: { status: "idle" } });
  check.mockReset();
  invoke.mockReset().mockResolvedValue(true);
  closeLogins.mockReset().mockResolvedValue(undefined);
  reopenLogins.mockReset();
});

describe("check", () => {
  it("passe de la recherche à « à jour » quand rien n'est publié", async () => {
    check.mockResolvedValue(null);
    await useUpdateStore.getState().check();
    expect(state().status).toBe("upToDate");
  });

  it("annonce la version trouvée, à installer à la main sur un paquet Linux", async () => {
    check.mockResolvedValue({ version: "1.2.0" });
    invoke.mockResolvedValue(false);
    await useUpdateStore.getState().check();
    expect(state()).toEqual({
      status: "available",
      version: "1.2.0",
      manual: true,
    });
  });

  it("garde l'état d'avant quand la recherche en arrière-plan échoue (hors ligne)", async () => {
    check.mockRejectedValue(new Error("réseau"));
    await useUpdateStore.getState().check(true);
    expect(state().status).toBe("idle");
    await useUpdateStore.getState().check();
    expect(state().status).toBe("error");
  });
});

describe("install", () => {
  it("suit le téléchargement puis attend le redémarrage", async () => {
    const seen: unknown[] = [];
    check.mockResolvedValue({
      version: "1.2.0",
      download: async (onEvent: (event: unknown) => void): Promise<void> => {
        onEvent({ event: "Started", data: { contentLength: 100 } });
        onEvent({ event: "Progress", data: { chunkLength: 40 } });
        seen.push(state());
        onEvent({ event: "Finished" });
      },
      install: async () => undefined,
    });
    await useUpdateStore.getState().check();
    await useUpdateStore.getState().install();
    expect(seen).toEqual([
      { status: "downloading", version: "1.2.0", progress: 0.4 },
    ]);
    expect(state()).toEqual({ status: "ready", version: "1.2.0" });
  });
});

describe("connexions en cours", () => {
  it("les laisse finir avant d'installer, puis les rouvre", async () => {
    const order: string[] = [];
    closeLogins.mockImplementation(async () => {
      order.push("close");
    });
    reopenLogins.mockImplementation(() => order.push("reopen"));
    check.mockResolvedValue({
      version: "1.2.0",
      download: async () => {
        order.push("download");
      },
      install: async () => {
        order.push("install");
      },
    });
    await useUpdateStore.getState().check();
    await useUpdateStore.getState().install();
    expect(order).toEqual(["download", "close", "install", "reopen"]);
  });

  it("les laisse finir avant de redémarrer", async () => {
    await useUpdateStore.getState().restart();
    expect(closeLogins.mock.invocationCallOrder[0]).toBeLessThan(
      invoke.mock.invocationCallOrder[0]
    );
    expect(invoke).toHaveBeenCalledWith("restart_app");
  });
});
