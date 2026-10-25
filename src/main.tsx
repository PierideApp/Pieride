// En premier : remplace fetch avant que toute bibliothèque ne le lise.
import "@/lib/http";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "@/app/App";
import { migrateDatabase } from "@/database";
import i18n from "@/lib/i18n";
import { accountManager } from "@/services";

const root = createRoot(document.getElementById("root") as HTMLElement);

// La base doit être à jour avant le premier écran qui la lit.
migrateDatabase().then(
  () => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
    void accountManager.start();
  },
  (error: unknown) => {
    // Le détail ne contient que du SQL de migration, utile pour un signalement.
    // eslint-disable-next-line no-console
    console.error(error);
    root.render(<p role="alert">{i18n.t("errors.database")}</p>);
  }
);
