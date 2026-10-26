// Boutons de la fenêtre sous Windows et Linux, où elle n'a pas de décorations
// (tauri.conf.json). Sous macOS, les boutons natifs restent à gauche (tauri.macos.conf.json).
// Les zones vides marquées `data-tauri-drag-region` déplacent la fenêtre ; double-clic : agrandir.
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTranslation } from "react-i18next";

import { isMac } from "@/lib/platform";

import styles from "./layout.module.scss";

const BUTTONS = ["minimize", "maximize", "close"] as const;

const ICONS: Record<(typeof BUTTONS)[number], string> = {
  minimize: "M6 12h12",
  maximize:
    "M7 6h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z",
  close: "M17 7 7 17M7 7l10 10",
};

/** `onBrand` : posés sur le fond indigo (écrans de démarrage), sinon sur la page. */
export function WindowControls({
  tone = "onPage",
}: {
  tone?: "onPage" | "onBrand";
}) {
  const { t } = useTranslation();
  if (isMac) {
    return null;
  }
  const appWindow = getCurrentWindow();
  const actions = {
    minimize: () => appWindow.minimize(),
    maximize: () => appWindow.toggleMaximize(),
    close: () => appWindow.close(),
  };
  return (
    <div className={`${styles.controls} ${styles[tone]}`}>
      {BUTTONS.map(action => (
        <button
          key={action}
          type="button"
          className={action === "close" ? styles.close : styles.button}
          aria-label={t(`window.${action}`)}
          title={t(`window.${action}`)}
          onClick={() => void actions[action]()}
        >
          <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
            <path d={ICONS[action]} />
          </svg>
        </button>
      ))}
    </div>
  );
}
