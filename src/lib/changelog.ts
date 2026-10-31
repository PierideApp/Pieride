// Notes de version : un fichier Markdown par version dans `changelog/`, à la racine du dépôt,
// lu au build. Une nouvelle version = un nouveau fichier, sans code à toucher. Le dossier
// n'existe pas encore : il arrivera avec la première version publiée.
// Repris du site de StewardPad (même auteur).
//
// Format : `changelog/0.2.0.md` en français (la référence), `changelog/en/0.2.0.md` pour sa
// traduction. Un en-tête `version`, `date` (AAAA-MM-JJ) et `title` entre deux lignes `---`,
// puis des sections `### Ajouts`, `### Changements`, `### Corrections`. Seuls les titres,
// listes `- `, paragraphes, `**gras**` et `` `code` `` sont lus.
import type { Language } from "@/stores/settings";

/** Une version, telle que l'écrit son fichier. */
export interface Release {
  /** Sans le « v » : 0.2.0, 0.1.0-alpha.1. */
  version: string;
  /** AAAA-MM-JJ. */
  date: string;
  title: string;
  /** Les notes, en Markdown. */
  body: string;
}

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
// 1.2.3 ou une préversion (1.2.3-alpha.1), comme dans tauri.conf.json.
const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Le « v » du tag git est accepté dans le nom du fichier et dans l'en-tête. */
const bare = (version: string) => version.replace(/^v/, "");

function fields(block: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of block.split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon > 0) {
      map.set(line.slice(0, colon).trim(), line.slice(colon + 1).trim());
    }
  }
  return map;
}

/** Lit un fichier ; une erreur nomme le fichier quand son en-tête est faux. */
export function parseRelease(file: string, raw: string): Release {
  const match = FRONT_MATTER.exec(raw);
  if (!match?.[1]) {
    throw new Error(`${file} : il doit commencer par un en-tête --- … ---`);
  }
  const meta = fields(match[1]);
  const version = bare(meta.get("version") ?? "");
  const date = meta.get("date") ?? "";
  if (!VERSION.test(version)) {
    throw new Error(
      `${file} : « version » doit ressembler à 1.2.3 ou 1.2.3-alpha.1`
    );
  }
  if (bare(file.replace(/^.*\//, "").replace(/\.md$/, "")) !== version) {
    throw new Error(`${file} : « version » n'est pas le nom du fichier`);
  }
  if (!DATE.test(date)) {
    throw new Error(`${file} : « date » doit ressembler à 2026-10-14`);
  }
  return {
    version,
    date,
    title: meta.get("title") ?? "",
    body: raw.slice(match[0].length).trim(),
  };
}

function compareIdentifiers(a: string, b: string): number {
  const numeric = [/^\d+$/.test(a), /^\d+$/.test(b)];
  if (numeric[0] && numeric[1]) {
    return Number(a) - Number(b);
  }
  if (numeric[0] !== numeric[1]) {
    return numeric[0] ? -1 : 1;
  }
  return a.localeCompare(b);
}

/** Une préversion passe avant la version qu'elle prépare, puis identifiant par identifiant. */
function comparePrerelease(a?: string, b?: string): number {
  if (a === undefined || b === undefined) {
    return a ? -1 : b ? 1 : 0;
  }
  const ia = a.split(".");
  const ib = b.split(".");
  for (let i = 0; i < Math.min(ia.length, ib.length); i++) {
    const diff = compareIdentifiers(ia[i] ?? "", ib[i] ?? "");
    if (diff !== 0) {
      return diff;
    }
  }
  return ia.length - ib.length;
}

/** L'ordre des versions : 0.1.0-alpha.1 < 0.1.0-alpha.2 < 0.1.0 < 0.10.0. */
export function compareVersions(a: string, b: string): number {
  const pa = VERSION.exec(a);
  const pb = VERSION.exec(b);
  if (!pa || !pb) {
    return a.localeCompare(b);
  }
  for (let i = 1; i <= 3; i++) {
    const diff = Number(pa[i]) - Number(pb[i]);
    if (diff !== 0) {
      return diff;
    }
  }
  return comparePrerelease(pa[4], pb[4]);
}

/** Seuls les fichiers nommés d'après une version sont des notes (pas le README). */
export const isReleaseFile = (file: string) =>
  /(^|\/)v?\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?\.md$/.test(file);

/** Les notes découpées en blocs : la petite partie du Markdown que les fichiers utilisent. */
export type Block =
  | { kind: "heading"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "paragraph"; text: string };

export function parseNotes(body: string): Block[] {
  const blocks: Block[] = [];
  /** Le dernier bloc continue sur la ligne suivante, tant qu'aucune ligne vide ne le coupe. */
  let open = false;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    const last = blocks.at(-1);
    if (line === "") {
      open = false;
    } else if (line.startsWith("#")) {
      blocks.push({ kind: "heading", text: line.replace(/^#+\s*/, "") });
      open = false;
    } else if (line.startsWith("- ")) {
      if (last?.kind === "list") {
        last.items.push(line.slice(2));
      } else {
        blocks.push({ kind: "list", items: [line.slice(2)] });
      }
      open = true;
    } else if (open && last?.kind === "list") {
      last.items[last.items.length - 1] += ` ${line}`;
    } else if (open && last?.kind === "paragraph") {
      last.text += ` ${line}`;
    } else {
      blocks.push({ kind: "paragraph", text: line });
      open = true;
    }
  }
  return blocks;
}

/** Le texte d'un bloc, avec ses passages en `**gras**` et en `` `code` ``. */
export function parseInline(
  text: string
): { kind: "text" | "strong" | "code"; text: string }[] {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/)
    .filter(Boolean)
    .map(part =>
      part.startsWith("**")
        ? { kind: "strong", text: part.slice(2, -2) }
        : part.startsWith("`")
          ? { kind: "code", text: part.slice(1, -1) }
          : { kind: "text", text: part }
    );
}

// Tous les fichiers de `changelog/`, embarqués dans l'app. À la racine : le français ; dans
// `en/` : leur traduction.
export const CHANGELOG_FILES = import.meta.glob<string>(
  "../../changelog/**/*.md",
  {
    query: "?raw",
    import: "default",
    eager: true,
  }
);

/** La langue d'un fichier : son dossier, ou le français à la racine. */
const languageOf = (file: string) =>
  /changelog\/([a-z]{2})\/[^/]+$/.exec(file)?.[1] ?? "fr";

function read(files: Record<string, string>) {
  return Object.entries(files)
    .filter(([file]) => isReleaseFile(file))
    .flatMap(([file, raw]) => {
      try {
        return [
          { language: languageOf(file), release: parseRelease(file, raw) },
        ];
      } catch (error) {
        // `pnpm test` refuse un fichier cassé avant la publication ; s'il passe quand même,
        // les autres versions restent affichées.
        // eslint-disable-next-line no-console
        console.error(error);
        return [];
      }
    });
}

/** Les versions dans une langue, de la plus récente à la plus ancienne (français par défaut). */
export function releases(
  language: Language,
  files: Record<string, string> = CHANGELOG_FILES
): Release[] {
  const all = read(files);
  return all
    .filter(({ language: lang }) => lang === "fr")
    .map(
      ({ release }) =>
        all.find(
          entry =>
            entry.language === language &&
            entry.release.version === release.version
        )?.release ?? release
    )
    .sort((a, b) => compareVersions(b.version, a.version));
}
