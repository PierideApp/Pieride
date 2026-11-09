// En premier : remplace fetch avant que toute bibliothèque ne le lise.
import "@/lib/http";

import { getCurrentWindow } from "@tauri-apps/api/window";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "@/app/App";
import i18n from "@/lib/i18n";

import { startScreen } from "@/app/layout/StartScreen";
import { ErrorBoundary } from "@/app/layout/ErrorBoundary";
import { createTray } from "@/app/tray";
import { migrateDatabase } from "@/database";
import { report } from "@/lib/log";
import { isMac } from "@/lib/platform";
import { accountManager } from "@/services";
import { forgetOrphanSecrets } from "@/stores/accounts";
import { useSettingsStore } from "@/stores/settings";

declare global {
  interface Window {
    appIsReady: () => void;
    appError: (error: string) => void;
  }
}

document.documentElement.dataset.platform = isMac ? "mac" : "other";

// Hors dev, pas de menu du navigateur au clic droit (Recharger, Retour, Imprimer…) : il
// casserait l'app. Les champs de texte le gardent, pour copier et coller. « Inspecter »
// n'existe qu'en dev : sans la fonctionnalité `devtools` (Cargo.toml), Tauri ne compile pas
// les outils de développement dans l'app publiée.
if (import.meta.env.PROD) {
  window.addEventListener("contextmenu", event => {
    const field =
      event.target instanceof Element &&
      event.target.closest("input, textarea, [contenteditable]");
    if (!field) {
      event.preventDefault();
    }
  });
}

// Lancée à l'ouverture de session, la fenêtre reste cachée (main.rs) : on la montre si
// l'utilisateur ne veut pas démarrer dans la barre des tâches. Sans effet sinon.
if (!useSettingsStore.getState().startMinimized) {
  void getCurrentWindow().show();
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("index.html n'a pas d'élément #root");
}
const root = createRoot(container);
root.render(startScreen(i18n.t("app.loading"), "status"));

// Le détail ne contient que du SQL ou un code d'erreur, utile pour un signalement.
const fail = (error: unknown) => report("app", error);

// La base doit être à jour avant le premier écran qui la lit.
migrateDatabase().then(
  () => {
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>
    );
    accountManager.start().catch(fail);
    forgetOrphanSecrets().catch(fail);
    createTray().catch(fail);
  },
  (error: unknown) => {
    reportError(error, "errors.database");
  }
);

function reportError(error: unknown, displayError: string) {
  fail(error);
  window.appError(i18n.t(displayError));
  root.render(startScreen(i18n.t(displayError), "alert"));
}
