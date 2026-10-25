// La base de l'app. Les tests créent la leur avec `createDb(nodeDriver())`.
import { createDb, pluginDriver } from "./client";
import { migrate } from "./migrate";

const driver = pluginDriver();

export const db = createDb(driver);

/** À attendre avant d'afficher un écran qui lit la base. */
export const migrateDatabase = () => migrate(driver);
