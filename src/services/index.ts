import { db } from "@/database";

import { AccountManager } from "./account-manager";

// Chaque service ajoutera ici sa fonction de connexion : PRONOTE en M3, les autres en M4.
export const accountManager = new AccountManager(db, {});
