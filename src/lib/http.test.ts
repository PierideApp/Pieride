import { invoke } from "@tauri-apps/api/core";
import { fetch as pluginFetch } from "@tauri-apps/plugin-http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ServiceUnavailable } from "@/services/shared/errors";

import { devRequest } from "./devlog";
import { fetcher, pronoteFetcher, redactUrl } from "./http";
import { getLog } from "./log";

// http.ts remplace globalThis.fetch dès son import : l'environnement doit exister avant.
const nativeFetch = vi.hoisted(() => {
  const nativeFetch = vi.fn(async () => new Response("natif"));
  vi.stubGlobal("fetch", nativeFetch);
  vi.stubGlobal("location", new URL("http://localhost:1420/"));
  return nativeFetch;
});
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));
vi.mock("./devlog", () => ({ devRequest: vi.fn() }));
const plugin = vi.mocked(pluginFetch);
const command = vi.mocked(invoke);

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  nativeFetch.mockClear();
  plugin.mockReset();
  plugin.mockImplementation(
    async () => new Response("plugin", { headers: { "Set-Cookie": "id=1" } })
  );
  command.mockReset();
  command.mockResolvedValue({
    status: 200,
    headers: [["set-cookie", "id=1"]],
    content: "instance",
  });
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

  it("passe chaque requête, son état et sa durée au journal de dev", async () => {
    vi.mocked(devRequest).mockClear();
    await pronoteFetcher({ url, method: "POST", content: "{}" });
    plugin.mockRejectedValue("Request cancelled");
    await expect(fetcher({ url })).rejects.toThrow(ServiceUnavailable);
    expect(vi.mocked(devRequest).mock.calls).toEqual([
      [
        expect.objectContaining({
          url,
          method: "POST",
          content: "{}",
          status: 200,
        }),
      ],
      [expect.objectContaining({ url, method: "GET", status: undefined })],
    ]);
  });

  it("rend le contenu, le statut et Set-Cookie", async () => {
    const response = await fetcher({ url });
    expect(response).toMatchObject({ status: 200, content: "plugin" });
    expect(response.headers.get("Set-Cookie")).toBe("id=1");
  });
});

describe("pronoteFetcher", () => {
  const url = new URL(
    "https://0000000a.index-education.net/pronote/appelfonction/3/42"
  );

  it("passe par instance_fetch, pas par le plugin", async () => {
    await pronoteFetcher({ url, method: "POST", content: "{}" });
    await pronoteFetcher({ url, redirect: "manual" });
    expect(plugin).not.toHaveBeenCalled();
    expect(command.mock.calls).toEqual([
      [
        "instance_fetch",
        expect.objectContaining({
          url: url.href,
          method: "POST",
          body: "{}",
          follow: true,
        }),
      ],
      [
        "instance_fetch",
        expect.objectContaining({ method: "GET", body: null, follow: false }),
      ],
    ]);
  });

  it("met le User-Agent de PRONOTE et garde les autres en-têtes", async () => {
    await pronoteFetcher({
      url,
      headers: { "User-Agent": "autre", Cookie: "appliMobile=1" },
    });
    expect(command.mock.calls[0][1]).toMatchObject({
      headers: [
        ["cookie", "appliMobile=1"],
        ["user-agent", expect.stringContaining("PRONOTE Mobile APP")],
      ],
    });
  });

  it("rend le contenu, le statut et les en-têtes", async () => {
    const response = await pronoteFetcher({ url });
    expect(response).toMatchObject({ status: 200, content: "instance" });
    expect(response.headers.get("Set-Cookie")).toBe("id=1");
  });

  it("note au journal la cause d'un échec, sans l'URL", async () => {
    command.mockRejectedValue("timeout");
    await expect(pronoteFetcher({ url })).rejects.toThrow(ServiceUnavailable);
    expect(getLog().requests.at(-1)).toMatchObject({
      method: "GET",
      host: url.host,
      status: undefined,
      failure: "timeout",
    });
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
