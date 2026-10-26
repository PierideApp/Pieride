// En premier : remplace fetch avant que toute bibliothèque ne le lise.
import "@/lib/http";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "@/app/App";
import { WindowControls } from "@/app/layout/WindowControls";
import { createTray } from "@/app/tray";
import { migrateDatabase } from "@/database";
import i18n from "@/lib/i18n";
import { isMac } from "@/lib/platform";
import { accountManager } from "@/services";

document.documentElement.dataset.platform = isMac ? "mac" : "other";

// Écrans de démarrage : sans décorations, la fenêtre doit pouvoir être déplacée et fermée.
const startScreen = (text: string, role: "status" | "alert") => (
  <>
    <WindowControls tone="onBrand" />
    <p role={role} data-tauri-drag-region>
      {text}
    </p>
  </>
);

const root = createRoot(document.getElementById("root") as HTMLElement);
root.render(startScreen(i18n.t("app.loading"), "status"));

// Le détail ne contient que du SQL ou un code d'erreur, utile pour un signalement.
// eslint-disable-next-line no-console
const report = (error: unknown) => console.error(error);

// La base doit être à jour avant le premier écran qui la lit.
migrateDatabase().then(
  () => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
    accountManager.start().catch(report);
    createTray().catch(report);
  },
  (error: unknown) => {
    report(error);
    root.render(startScreen(i18n.t("errors.database"), "alert"));
  }
);
