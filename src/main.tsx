// En premier : remplace fetch avant que toute bibliothèque ne le lise.
import "@/lib/http";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "@/app/App";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
