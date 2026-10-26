import { db } from "@/database";

import { AccountManager } from "./account-manager";

// Chaque service ajoutera ici sa fonction de connexion : PRONOTE en M3, les autres en M4.
// Les données fictives n'existent qu'en dev : `import.meta.env.DEV` vaut `false` au build,
// et l'app publiée ne contient pas `./mock`.
export const accountManager = new AccountManager(
  db,
  import.meta.env.DEV
    ? {
        mock: async (...args) => (await import("./mock")).connectMock(...args),
      }
    : {}
);
