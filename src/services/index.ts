import { db } from "@/database";

import { AccountManager } from "./account-manager";

// Les fonctions de connexion sont chargées à la demande. Les données fictives n'existent
// qu'en dev : `import.meta.env.DEV` vaut
// `false` au build, et l'app publiée ne contient pas `./mock`.
export const accountManager = new AccountManager(db, {
  pronote: async (...args) =>
    (await import("./pronote")).connectPronote(...args),
  ecoledirecte: async (...args) =>
    (await import("./ecoledirecte")).connectEcoledirecte(...args),
  ...(import.meta.env.DEV
    ? {
        mock: async (...args) => (await import("./mock")).connectMock(...args),
      }
    : {}),
});
