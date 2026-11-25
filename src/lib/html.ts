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
