// La base de l'app. Les tests créent la leur avec `createDb(nodeDriver())`.
import { createDb, tauriDriver } from "./client";
import { migrate } from "./migrate";

export const db = createDb(tauriDriver);

/** À attendre avant d'afficher un écran qui lit la base. */
export const migrateDatabase = () => migrate(tauriDriver);
