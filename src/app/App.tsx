import "@/styles/theme.scss";

import { useLayoutEffect } from "react";
import { HashRouter } from "react-router";

import { Layout } from "@/app/layout/Layout";
import { Onboarding } from "@/app/onboarding/Onboarding";
import { useAccounts } from "@/hooks/useAccounts";
import { useTheme } from "@/hooks/useTheme";

export default function App() {
  useTheme();
  const accounts = useAccounts();

  useLayoutEffect(() => {
    //window.appIsReady();

    setTimeout(() => {
      window.appError("Erreur de test");
    }, 6000);
  }, [])

  // Quelques millisecondes : sans ça, le cadre s'afficherait un instant avant le premier lancement.
  if (accounts.status === "loading") {
    return null;
  }
  if (accounts.status === "ready" && accounts.data.length === 0) {
    return <Onboarding />;
  }
  // Routeur à base de hash : mêmes adresses en dev (Vite) et dans l'app (protocole de Tauri).
  return (
    <HashRouter>
      <Layout accounts={accounts} />
    </HashRouter>
  );
}
