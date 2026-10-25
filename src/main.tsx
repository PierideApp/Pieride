// En premier : remplace fetch avant que toute bibliothèque ne le lise.
import "@/lib/http";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "@/app/App";
import { migrateDatabase } from "@/database";
import i18n from "@/lib/i18n";
import { accountManager } from "@/services";

const root = createRoot(document.getElementById("root") as HTMLElement);
root.render(<p role="status">{i18n.t("app.loading")}</p>);

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
  },
  (error: unknown) => {
    report(error);
    root.render(<p role="alert">{i18n.t("errors.database")}</p>);
  }
);
