import { defineConfig } from "drizzle-kit";

// `pnpm db:generate` : écrit dans `migrations/` le SQL qui fait passer la base au nouveau schéma.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/database/schema.ts",
  out: "./src/database/migrations",
});
