import { db } from "@/database";

import { AccountManager } from "./account-manager";

// La fonction de connexion de chaque service, chargée à la demande. Les autres services
// arrivent en M4. Les données fictives n'existent qu'en dev : `import.meta.env.DEV` vaut
// `false` au build, et l'app publiée ne contient pas `./mock`.
export const accountManager = new AccountManager(db, {
  pronote: async (...args) =>
    (await import("./pronote")).connectPronote(...args),
  ...(import.meta.env.DEV
    ? {
        mock: async (...args) => (await import("./mock")).connectMock(...args),
      }
    : {}),
});
