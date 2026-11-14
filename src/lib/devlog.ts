// Les requêtes des services dans la console de la WebView, seulement sous `pnpm tauri dev` : les
// appels sont gardés par `import.meta.env.DEV`, que Vite remplace par `false` dans la version
// publiée (code retiré), et `isTauri()` écarte `pnpm dev` seul dans un navigateur et les tests.
// Filtrer la console sur `[pronote]` ou `[ecoledirecte]` pour isoler les appels et leur durée.
import { isTauri } from "@tauri-apps/api/core";

type DevService = "pronote" | "ecoledirecte" | "other";

/**
 * Requêtes de connexion : identifiant, défi, nouveau jeton, code PIN, adresse de connexion à un
 * partenaire. Leur contenu n'est jamais affiché, même en dev.
 */
const HIDDEN = new Set([
  "FonctionParametres",
  "Identification",
  "Authentification",
  "SecurisationCompteDoubleAuth",
  "SaisieURLPartenaire",
]);

/** La dernière requête PRONOTE vue par le fetcher : son état et sa durée vont à son échange. */
let last: { name: string; outcome: string } | null = null;

/**
 * Le nom de la fonction PRONOTE, en clair dans le corps JSON d'un `appelfonction` : `nom`, ou
 * `id` depuis PRONOTE 2025.1.3, qui a renommé les clés.
 */
function functionName(content: string | undefined): string {
  let value: unknown;
  try {
    value = JSON.parse(content ?? "");
  } catch {
    return "?";
  }
  if (typeof value !== "object" || value === null) {
    return "?";
  }
  const { nom, id }: { nom?: unknown; id?: unknown } = value;
  return typeof nom === "string" ? nom : typeof id === "string" ? id : "?";
}

/** Métadonnées réseau de développement : jamais le corps ni les paramètres de l'URL. */
export function devRequest(request: {
  url: URL;
  method: string;
  content?: string;
  status?: number;
  duration: number;
  service?: DevService;
}): void {
  if (!isTauri()) {
    return;
  }
  const outcome = `${request.status ?? "échec"} · ${Math.round(request.duration)} ms`;
  const service =
    request.service === "other"
      ? undefined
      : (request.service ??
        (request.url.hostname === "ecoledirecte.com" ||
        request.url.hostname.endsWith(".ecoledirecte.com")
          ? "ecoledirecte"
          : undefined));
  if (service === "ecoledirecte") {
    // Les ID d'élève apparaissent dans le chemin ÉcoleDirecte : on les masque aussi.
    const path = request.url.pathname.replace(/\/\d+(?=\/|$)/g, "/:id");
    console.log(
      `[ecoledirecte] ${request.method} ${request.url.host}${path} · ${outcome}`
    );
    return;
  }
  if (!request.url.pathname.includes("/appelfonction/")) {
    // Sans la query string, qui peut porter un jeton.
    console.log(
      `[${service ?? "http"}] ${request.method} ${request.url.host}${request.url.pathname} · ${outcome}`
    );
    return;
  }
  const name = functionName(request.content);
  if (request.status === undefined) {
    // Aucune réponse : pawnote n'aura rien à déchiffrer, l'échange n'arrivera pas.
    console.log(`[pronote] ${name} · ${outcome}`);
    return;
  }
  last = { name, outcome };
}

/** Un échange avec PRONOTE, en clair : ce qui est parti, puis la réponse ou l'erreur de lecture. */
export function devExchange(exchange: {
  name: string;
  request: unknown;
  response?: unknown;
  error?: unknown;
}): void {
  if (!isTauri()) {
    return;
  }
  const { name, request, response, error } = exchange;
  const outcome = last?.name === name ? ` · ${last.outcome}` : "";
  last = null;
  const label = `[pronote] ${name}${outcome}${error === undefined ? "" : " · réponse refusée"}`;
  if (HIDDEN.has(name)) {
    console.log(`${label} (contenu masqué : connexion)`);
    return;
  }
  console.groupCollapsed(label);
  console.log("envoyé", request);
  if (error === undefined) {
    console.log("reçu", response);
  } else {
    console.log("erreur", error);
  }
  console.groupEnd();
}

/** Ce que pawnote a tiré des échanges d'une requête, juste après eux dans la console. */
export function devResult(service: string, result: unknown): void {
  if (isTauri() && result !== undefined) {
    console.log(`[${service}] ↳ résultat de pawnote`, result);
  }
}
