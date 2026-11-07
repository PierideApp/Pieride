import { WindowControls } from "@/app/layout/WindowControls";

// Écrans de démarrage : sans décorations, la fenêtre doit pouvoir être déplacée et fermée.
export function startScreen(text: string, role: "status" | "alert") {
  return (
    <>
      <WindowControls tone="onBrand" />
      <p role={role} data-tauri-drag-region>
        {text}
      </p>
    </>
  );
}
