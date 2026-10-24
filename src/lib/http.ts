// Couche réseau : la WebView applique le CORS, donc toute requête vers un serveur
// extérieur passe par le plugin http de Tauri, qui ne laisse passer que les domaines
// autorisés (capabilities/ et `allowInstance`). Importé en premier dans main.tsx.
import { invoke } from "@tauri-apps/api/core";
import { fetch as pluginFetch } from "@tauri-apps/plugin-http";

import { ServiceUnavailable } from "@/services/shared/errors";

/** Origine seule : le chemin et la query string peuvent porter un identifiant ou un jeton. */
export function redactUrl(url: string | URL): string {
  try {
    return new URL(url).origin;
  } catch {
    return "[URL invalide]";
  }
}

// Les URL internes de Tauri (ipc:, asset:, http://ipc.localhost) et l'origine de l'app
// restent sur le fetch natif : l'IPC de Tauri appelle lui-même fetch, sinon boucle infinie.
const isExternal = (url: URL) =>
  (url.protocol === "https:" || url.protocol === "http:") &&
  url.origin !== location.origin &&
  !url.hostname.endsWith(".localhost");

async function externalFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  // Le plugin ignore `redirect` : « manual » s'écrit maxRedirections = 0.
  const redirect =
    init?.redirect ?? (input instanceof Request ? input.redirect : "follow");
  try {
    return await pluginFetch(input, {
      ...init,
      maxRedirections: redirect === "manual" ? 0 : undefined,
    });
  } catch (error) {
    // Les erreurs du plugin recopient l'URL complète : on garde la raison, pas l'URL.
    const reason = String(error).replace(
      /\b[a-z][a-z0-9+.-]*:\/\/\S+/gi,
      redactUrl
    );
    throw new ServiceUnavailable(`Requête impossible : ${reason}`);
  }
}

// Pour les bibliothèques qui appellent fetch() directement (blocksdirecte, skolengojs…).
const nativeFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (input, init) => {
  const url = new URL(
    input instanceof Request ? input.url : input,
    location.href
  );
  return isExternal(url)
    ? externalFetch(input, init)
    : nativeFetch(input, init);
};

// Type `Fetcher` de @literate.ink/utilities (MIT), attendu par pawnote, blocksrd et ezly.
// Recopié pour ne pas ajouter de dépendance : TypeScript signalera tout écart.
export type Fetcher = (request: {
  url: URL;
  method?: "GET" | "POST";
  content?: string;
  headers?: Record<string, string> | Headers;
  redirect?: "follow" | "manual";
}) => Promise<{ status: number; content: string; headers: Headers }>;

function createFetcher(userAgent?: string): Fetcher {
  return async ({ url, method = "GET", content, headers, redirect }) => {
    const finalHeaders = new Headers(headers);
    if (userAgent) {
      finalHeaders.set("User-Agent", userAgent);
    }
    const response = await externalFetch(url, {
      method,
      headers: finalHeaders,
      body: method === "GET" ? undefined : content,
      redirect,
    });
    return {
      status: response.status,
      content: await response.text(),
      headers: response.headers,
    };
  };
}

export const fetcher = createFetcher();

// PRONOTE ne répond à la connexion mobile qu'avec le User-Agent de son application.
export const pronoteFetcher = createFetcher(
  "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 PRONOTE Mobile APP Version/2.0.11"
);

/** Ouvre au plugin http l'adresse d'un compte (instance PRONOTE, URL iCal…), après validation côté Rust. */
export const allowInstance = (url: string) =>
  invoke<void>("allow_instance", { url });
