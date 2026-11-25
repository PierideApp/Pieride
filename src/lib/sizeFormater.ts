/**
 * Formate un nombre de bytes en une chaîne lisible par l'homme, avec des unités appropriées (o, Ko, Mo, Go, To, Po).
 * Exemple : 1234567890 → "1,15 Go"
 *
 * @param bytes La taille à formater
 * @param decimals Le nombre de décimales à afficher (par défaut 2)
 * @returns la taille formatée en chaîne de caractères
 */
export function sizeFormater(bytes: number, decimals = 2): string {
  if (bytes === 0) {
    return "0 o";
  }

  const units = ["o", "Ko", "Mo", "Go", "To", "Po"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${parseFloat((bytes / Math.pow(1024, index)).toFixed(decimals))} ${units[index]}`;
}
