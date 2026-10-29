import { fetch as pluginFetch } from "@tauri-apps/plugin-http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ServiceUnavailable } from "@/services/shared/errors";

import { fetcher, pronoteFetcher, redactUrl } from "./http";

// http.ts remplace globalThis.fetch dès son import : l'environnement doit exister avant.
const nativeFetch = vi.hoisted(() => {
  const nativeFetch = vi.fn(async () => new Response("natif"));
  vi.stubGlobal("fetch", nativeFetch);
  vi.stubGlobal("location", new URL("http://localhost:1420/"));
  return nativeFetch;
});
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));
const plugin = vi.mocked(pluginFetch);

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  nativeFetch.mockClear();
  plugin.mockReset();
  plugin.mockImplementation(
    async () => new Response("plugin", { headers: { "Set-Cookie": "id=1" } })
  );
});

describe("fetch global", () => {
  it.each([
    "ipc://localhost/plugin%3Ahttp%7Cfetch",
    "http://ipc.localhost/plugin%3Ahttp%7Cfetch",
    "asset://localhost/image.png",
    "/src/main.tsx",
  ])("laisse %s au fetch natif", async url => {
    await fetch(url);
    expect(nativeFetch).toHaveBeenCalledOnce();
    expect(plugin).not.toHaveBeenCalled();
  });

  it.each(["https://api.ecoledirecte.com/v3/login.awp", "http://exemple.fr/"])(
    "envoie %s au plugin",
    async url => {
      await fetch(new Request(url));
      expect(plugin).toHaveBeenCalledOnce();
      expect(nativeFetch).not.toHaveBeenCalled();
    }
  );

  it("traduit redirect manual, en option ou dans la Request", async () => {
    await fetch("https://exemple.fr/", { redirect: "manual" });
    await fetch(new Request("https://exemple.fr/", { redirect: "manual" }));
    await fetch("https://exemple.fr/");
    expect(plugin.mock.calls.map(([, init]) => init?.maxRedirections)).toEqual([
      0,
      0,
      undefined,
    ]);
  });

  it("ne recopie pas l'URL dans l'erreur", async () => {
    plugin.mockRejectedValue(
      "url not allowed on the configured scope: https://pirate.example/vol?jeton=abc123"
    );
    const error = await fetch("https://pirate.example/vol?jeton=abc123").catch(
      (e: unknown) => e
    );
    expect(error).toBeInstanceOf(ServiceUnavailable);
    expect(String(error)).toContain("https://pirate.example");
    expect(String(error)).not.toContain("abc123");
  });

  it("rejette une URL invalide au lieu de lever l'erreur", async () => {
    const response = fetch("http://[");
    await expect(response).rejects.toThrow(TypeError);
  });

  it("rend l'AbortError d'une requête annulée, pas une panne", async () => {
    plugin.mockRejectedValue("Request cancelled");
    const error = await fetch("https://exemple.fr/", {
      signal: AbortSignal.abort(),
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DOMException);
    expect(error).toHaveProperty("name", "AbortError");
  });
});

describe("fetcher", () => {
  const url = new URL(
    "https://0000000a.index-education.net/pronote/appelfonction/3/42"
  );

  it("envoie le corps seulement hors GET et suit les redirections", async () => {
    await fetcher({ url });
    await fetcher({ url, method: "POST", content: "{}" });
    expect(plugin.mock.calls[0][1]).toMatchObject({
      method: "GET",
      body: undefined,
    });
    expect(plugin.mock.calls[1][1]).toMatchObject({
      method: "POST",
      body: "{}",
    });
    expect(plugin.mock.calls[1][1]?.maxRedirections).toBeUndefined();
  });

  it("traduit redirect manual pour le plugin", async () => {
    await fetcher({ url, redirect: "manual" });
    expect(plugin.mock.calls[0][1]?.maxRedirections).toBe(0);
  });

  it("met le User-Agent de PRONOTE et garde les autres en-têtes", async () => {
    await pronoteFetcher({
      url,
      headers: { "User-Agent": "autre", "Content-Type": "text/plain" },
    });
    const headers = new Headers(plugin.mock.calls[0][1]?.headers);
    expect(headers.get("User-Agent")).toContain("PRONOTE Mobile APP");
    expect(headers.get("Content-Type")).toBe("text/plain");
  });

  it("traduit un délai dépassé en ServiceUnavailable", async () => {
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(
      AbortSignal.abort(new DOMException("", "TimeoutError"))
    );
    plugin.mockRejectedValue("Request cancelled");
    await expect(fetcher({ url })).rejects.toThrow(ServiceUnavailable);
  });

  it("traduit une réponse coupée en ServiceUnavailable", async () => {
    plugin.mockResolvedValue(
      new Response(
        new ReadableStream({
          start: controller => controller.error(new Error("coupé")),
        })
      )
    );
    await expect(fetcher({ url })).rejects.toThrow(ServiceUnavailable);
  });

  it("rend le contenu, le statut et Set-Cookie", async () => {
    const response = await fetcher({ url });
    expect(response).toMatchObject({ status: 200, content: "plugin" });
    expect(response.headers.get("Set-Cookie")).toBe("id=1");
  });
});

describe("redactUrl", () => {
  it("ne garde que l'origine", () => {
    expect(
      redactUrl(
        "https://eleve:mdp@api.ecoledirecte.com/v3/eleves/1234/notes.awp?token=x"
      )
    ).toBe("https://api.ecoledirecte.com");
    expect(redactUrl("pas une url")).toBe("[URL invalide]");
  });
});
