// Icône dans la barre des tâches (UX §7) : un clic rouvre la fenêtre ; menu Ouvrir / Quitter.
// Créée depuis le front pour que son menu suive la langue (i18next).
import { defaultWindowIcon } from "@tauri-apps/api/app";
import { Menu, MenuItem } from "@tauri-apps/api/menu";
import { TrayIcon } from "@tauri-apps/api/tray";
import { getCurrentWindow } from "@tauri-apps/api/window";

import i18n from "@/lib/i18n";

const TRAY_ID = "main";

async function showWindow() {
  const window = getCurrentWindow();
  await window.unminimize();
  await window.show();
  await window.setFocus();
}

export async function createTray(): Promise<void> {
  // Déjà là si la page a été rechargée (en dev).
  if (await TrayIcon.getById(TRAY_ID)) {
    return;
  }
  const open = await MenuItem.new({
    id: "open",
    text: i18n.t("tray.open"),
    action: () => void showWindow(),
  });
  const quit = await MenuItem.new({
    id: "quit",
    text: i18n.t("tray.quit"),
    // Une seule fenêtre : la fermer quitte l'app.
    action: () => void getCurrentWindow().close(),
  });
  i18n.on("languageChanged", () => {
    void open.setText(i18n.t("tray.open"));
    void quit.setText(i18n.t("tray.quit"));
  });
  await TrayIcon.new({
    id: TRAY_ID,
    icon: (await defaultWindowIcon()) ?? undefined,
    tooltip: "Piéride",
    menu: await Menu.new({ items: [open, quit] }),
    showMenuOnLeftClick: false,
    action: event => {
      if (
        event.type === "Click" &&
        event.button === "Left" &&
        event.buttonState === "Up"
      ) {
        void showWindow();
      }
    },
  });
}
