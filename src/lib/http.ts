// Couche réseau : la WebView applique le CORS, donc toute requête vers un serveur
// extérieur passe par le plugin http de Tauri, qui ne laisse passer que les domaines
// autorisés (capabilities/ et `allowInstance`). Seul pawnote passe par notre commande
// `instance_fetch` (`pronoteFetcher`). Importé en premier dans main.tsx.
import { invoke } from "@tauri-apps/api/core";
import { fetch as pluginFetch } from "@tauri-apps/plugin-http";

import { ServiceUnavailable } from "@/services/shared/errors";

import { devRequest } from "./devlog";
import { logRequest } from "./log";

/** Origine seule : le chemin et la query string peuvent porter un identifiant ou un jeton. */
export function redactUrl(url: string | URL): string {
  try {
    return new URL(url).origin;
  } catch {
    return "[URL invalide]";
  }
}

/** Le domaine d'une requête, pour le journal. */
function hostOf(input: RequestInfo | URL): string {
  try {
    return new URL(input instanceof Request ? input.url : input).host;
  } catch {
    return "?";
  }
}

// Les URL internes de Tauri (ipc:, asset:, http://ipc.localhost) et l'origine de l'app
// restent sur le fetch natif : l'IPC de Tauri appelle lui-même fetch, sinon boucle infinie.
const isExternal = (url: URL) =>
  (url.protocol === "https:" || url.protocol === "http:") &&
  url.origin !== location.origin &&
  !url.hostname.endsWith(".localhost");

// Au-delà, une requête des bibliothèques est abandonnée : pawnote met en file les requêtes
// d'une session, une seule sans réponse bloquerait la connexion (comme dans Papillon).
const TIMEOUT = 60_000;

async function externalFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  // Le plugin ignore `redirect` : « manual » s'écrit maxRedirections = 0.
  const redirect =
    init?.redirect ?? (input instanceof Request ? input.redirect : "follow");
  // Pour le journal (Paramètres > Développeur) : le domaine seulement.
  const request = {
    method: init?.method ?? (input instanceof Request ? input.method : "GET"),
    host: hostOf(input),
  };
  const started = performance.now();
  try {
    const response = await pluginFetch(input, {
      ...init,
      maxRedirections: redirect === "manual" ? 0 : undefined,
    });
    logRequest({
      ...request,
      status: response.status,
      duration: performance.now() - started,
    });
    return response;
  } catch (error) {
    logRequest({ ...request, duration: performance.now() - started });
    // Annulée par l'appelant : la même erreur que le fetch natif (AbortError, TimeoutError).
    const signal =
      init?.signal ?? (input instanceof Request ? input.signal : null);
    // Pas `throwIfAborted()` : absent du WebKit de Safari 15 (macOS 12 pas à jour).
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException("Requête annulée", "AbortError");
    }
    throw new ServiceUnavailable(`Requête impossible : ${withoutUrls(error)}`);
  }
}

/** Les erreurs du plugin recopient l'URL complète : on garde la raison, pas l'URL. */
const withoutUrls = (error: unknown) =>
  String(error).replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, redactUrl);

// Pour les bibliothèques qui appellent fetch() directement (blocksdirecte, skolengojs…).
const nativeFetch = globalThis.fetch.bind(globalThis);
// `async` : une URL invalide rejette la promesse au lieu de lever l'erreur, comme le fetch natif.
globalThis.fetch = async (input, init) => {
  const url = new URL(
    input instanceof Request ? input.url : input,
    location.href
  );
  return isExternal(url)
    ? await externalFetch(input, init)
    : await nativeFetch(input, init);
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

export const fetcher: Fetcher = async ({
  url,
  method = "GET",
  content,
  headers,
  redirect,
}) => {
  // Pas `AbortSignal.timeout()` : absent du WebKit de Safari 15 (macOS 12 pas à jour).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  const { signal } = controller;
  const started = performance.now();
  let status: number | undefined;
  try {
    const response = await externalFetch(url, {
      method,
      headers,
      body: method === "GET" ? undefined : content,
      redirect,
      signal,
    });
    status = response.status;
    // Le journal (Paramètres > Développeur) n'a que le domaine, l'état et la durée
    // (`externalFetch`) : corps et en-têtes portent jetons, cookies et identifiants.
    return {
      status,
      content: await response.text(),
      headers: response.headers,
    };
  } catch (error) {
    if (error instanceof ServiceUnavailable) {
      throw error;
    }
    // Délai dépassé, ou réponse coupée pendant la lecture du corps.
    throw new ServiceUnavailable(
      signal.aborted ? "Pas de réponse du serveur" : "Réponse interrompue"
    );
  } finally {
    clearTimeout(timer);
    devFetch({ url, method, content, status }, started);
  }
};

/** Seulement sous `pnpm tauri dev` (lib/devlog.ts), avant que pawnote lise la réponse. */
function devFetch(
  request: { url: URL; method: string; content?: string; status?: number },
  started: number
) {
  if (import.meta.env.DEV) {
    devRequest({ ...request, duration: performance.now() - started });
  }
}

// PRONOTE ne répond à la connexion mobile qu'avec le User-Agent de son application.
const PRONOTE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 PRONOTE Mobile APP Version/2.0.11";

/** Ce que rend la commande `instance_fetch` (src-tauri/src/http.rs). */
interface InstanceResponse {
  status: number;
  headers: [string, string][];
  content: string;
}

/**
 * Pour pawnote. La commande Rust `instance_fetch` garde la connexion ouverte d'une requête à
 * l'autre, là où le plugin en ouvre une par requête : une première synchro en ouvrait une
 * soixantaine, et Windows en abandonnait. Mêmes adresses que le plugin (`allowInstance`),
 * délai de 60 s côté Rust.
 */
export const pronoteFetcher: Fetcher = async ({
  url,
  method = "GET",
  content,
  headers,
  redirect,
}) => {
  const finalHeaders = new Headers(headers);
  finalHeaders.set("User-Agent", PRONOTE_USER_AGENT);
  const started = performance.now();
  let status: number | undefined;
  let failure: string | undefined;
  try {
    const response = await invoke<InstanceResponse>("instance_fetch", {
      url: url.href,
      method,
      headers: [...finalHeaders],
      body: method === "GET" ? null : (content ?? null),
      follow: redirect !== "manual",
    });
    status = response.status;
    return {
      status,
      content: response.content,
      headers: new Headers(response.headers),
    };
  } catch (error) {
    // Un code de `instance_fetch` (`timeout`, `connect`…), ou une erreur de Tauri.
    failure = withoutUrls(error);
    throw new ServiceUnavailable(`Requête impossible : ${failure}`);
  } finally {
    logRequest({
      method,
      host: url.host,
      status,
      failure,
      duration: performance.now() - started,
    });
    devFetch({ url, method, content, status }, started);
  }
};

/**
 * Ouvre au plugin http l'adresse d'un compte (instance PRONOTE, URL iCal…), après validation
 * côté Rust. En cas de refus, la promesse est rejetée avec un code : `invalid_url`,
 * `https_required`, `credentials_in_url`, `ip_address`, `invalid_domain`, `local_domain`,
 * `instance_lock` ou `instance_capability`.
 */
export const allowInstance = (url: string) =>
  invoke<void>("allow_instance", { url });
