// Texte d'un contenu HTML venant d'un service (consigne d'un devoir PRONOTE), pour l'afficher
// comme du texte : rien n'est jamais inséré en HTML. `DOMParser` donne un document inerte
// (aucun script exécuté, aucune image chargée).

/** Éléments qui passent à la ligne. */
const BLOCKS = "br, p, div, li, tr, h1, h2, h3, h4, h5, h6";

export function htmlToText(html: string): string {
  const { body } = new DOMParser().parseFromString(html, "text/html");
  for (const element of body.querySelectorAll(BLOCKS)) {
    element.after("\n");
  }
  return (body.textContent ?? "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n[\s]*/g, "\n")
    .trim();
}

/** Décode les champs HTML parfois envoyés en Base64 par PRONOTE/ÉcoleDirecte. */
export function contentToHtml(value: string): string {
  const compact = value.replace(/\s/g, "");
  if (
    compact.length >= 4 &&
    compact.length % 4 === 0 &&
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      compact
    )
  ) {
    try {
      const bytes = Uint8Array.from(atob(compact), character =>
        character.charCodeAt(0)
      );
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      const hasControl = Array.from(decoded).some(character => {
        const code = character.charCodeAt(0);
        return code < 32 && code !== 9 && code !== 10 && code !== 13;
      });
      if (!hasControl) {
        return decoded;
      }
    } catch {
      // Le champ n'était pas du Base64 UTF-8 valide; il est affiché comme du texte normal.
    }
  }
  return value;
}

/** Décode un contenu de service puis le ramène à du texte pour la recherche et les aperçus. */
export function contentToText(value: string): string {
  return htmlToText(contentToHtml(value));
}

const NEWS_PLACEHOLDER = /^[\s.·•…–—_-]+$/u;

function isNewsPlaceholder(value: string): boolean {
  const plain = value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .trim();
  return plain.length > 0 && NEWS_PLACEHOLDER.test(plain);
}

/** HTML décodé pour l'affichage des actualités ; un post-it contenant seulement une image est gardé. */
export function newsContentToHtml(value: string): string {
  const html = contentToHtml(value);
  return isNewsPlaceholder(html) ? "" : html;
}
