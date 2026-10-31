// Recherche dans une liste (matières, établissements) : sans accents ni majuscules, chaque mot
// tapé doit apparaître, dans n'importe quel ordre.

/** Sans accents ni majuscules, pour comparer et chercher. */
export const simplify = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Vrai si chaque mot de `query` apparaît dans `text` ; une recherche vide garde tout. */
export function matches(text: string, query: string): boolean {
  const target = simplify(text);
  return simplify(query)
    .split(/\s+/)
    .filter(Boolean)
    .every(word => target.includes(word));
}
