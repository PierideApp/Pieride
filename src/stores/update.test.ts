import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUpdateStore } from "./update";

const { check, invoke } = vi.hoisted(() => ({
  check: vi.fn(),
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-updater", () => ({ check }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@/lib/log", () => ({ report: vi.fn() }));

const state = () => useUpdateStore.getState().state;

beforeEach(() => {
  useUpdateStore.setState({ state: { status: "idle" } });
  check.mockReset();
  invoke.mockReset().mockResolvedValue(true);
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
      downloadAndInstall: async (
        onEvent: (event: unknown) => void
      ): Promise<void> => {
        onEvent({ event: "Started", data: { contentLength: 100 } });
        onEvent({ event: "Progress", data: { chunkLength: 40 } });
        seen.push(state());
        onEvent({ event: "Finished" });
      },
    });
    await useUpdateStore.getState().check();
    await useUpdateStore.getState().install();
    expect(seen).toEqual([
      { status: "downloading", version: "1.2.0", progress: 0.4 },
    ]);
    expect(state()).toEqual({ status: "ready", version: "1.2.0" });
  });
});
