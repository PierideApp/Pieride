import process from "node:process";
import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const host = process.env.TAURI_DEV_HOST;

// https://v2.tauri.app/start/frontend/vite/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // Laisse les erreurs Rust visibles dans le terminal
  clearScreen: false,
  server: {
    // Tauri attend un port fixe
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  // Les dates des tests dépendent du fuseau : celui des élèves, avec changement d'heure,
  // même sur la CI qui tourne en UTC.
  test: { env: { TZ: "Europe/Paris" } },
});
