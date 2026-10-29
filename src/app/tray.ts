// Icône dans la barre des tâches (UX §7) : un clic rouvre la fenêtre ; menu Ouvrir / Quitter,
// précédé du coup d'œil (cours actuel et suivant) si l'utilisateur l'a gardé.
// Créée depuis le front pour que son menu suive la langue (i18next).
import { defaultWindowIcon } from "@tauri-apps/api/app";
import { Menu, MenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { TrayIcon } from "@tauri-apps/api/tray";
import { getCurrentWindow } from "@tauri-apps/api/window";

import i18n from "@/lib/i18n";
import { useSettingsStore } from "@/stores/settings";

const TRAY_ID = "main";

/** Le menu et les lignes du coup d'œil, une fois l'icône créée. */
let tray:
  | {
      icon: TrayIcon;
      menu: Menu;
      glance: [MenuItem, MenuItem, PredefinedMenuItem];
    }
  | undefined;

/** Le dernier coup d'œil demandé, appliqué dès que l'icône existe. */
let wanted: readonly [string, string] | null = null;

async function showWindow() {
  const window = getCurrentWindow();
  await window.unminimize();
  await window.show();
  await window.setFocus();
}

export async function createTray(): Promise<void> {
  // Déjà là si la page a été rechargée (en dev).
  const existing = await TrayIcon.getById(TRAY_ID);
  if (existing) {
    await existing.close();
  }
  const open = await MenuItem.new({
    id: "open",
    text: i18n.t("tray.open"),
    action: () => void showWindow(),
  });
  const quit = await MenuItem.new({
    id: "quit",
    text: i18n.t("tray.quit"),
    // Une seule fenêtre : la détruire quitte l'app, même si « fermer » la cache.
    action: () => void getCurrentWindow().destroy(),
  });
  i18n.on("languageChanged", () => {
    void open.setText(i18n.t("tray.open"));
    void quit.setText(i18n.t("tray.quit"));
  });
  const menu = await Menu.new({ items: [open, quit] });
  const icon = await TrayIcon.new({
    id: TRAY_ID,
    icon: (await defaultWindowIcon()) ?? undefined,
    tooltip: "Piéride",
    menu,
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
  tray = {
    icon,
    menu,
    glance: [
      await MenuItem.new({ text: "", enabled: false }),
      await MenuItem.new({ text: "", enabled: false }),
      await PredefinedMenuItem.new({ item: "Separator" }),
    ],
  };

  // Fermer la fenêtre la cache dans la barre des tâches, si l'utilisateur l'a choisi. Seulement
  // quand l'icône existe : sinon, plus rien ne permettrait de la rouvrir.
  await getCurrentWindow().onCloseRequested(event => {
    if (useSettingsStore.getState().closeToTray) {
      event.preventDefault();
      void getCurrentWindow().hide();
    }
  });
  await setTrayGlance(wanted);
}

/**
 * Le coup d'œil : deux lignes en tête du menu et dans l'info-bulle de l'icône.
 * `null` le retire (réglage coupé, aucun compte).
 */
export async function setTrayGlance(
  lines: readonly [string, string] | null
): Promise<void> {
  wanted = lines;
  if (!tray) {
    return;
  }
  const { icon, menu, glance } = tray;
  const shown = (await menu.items()).length > 2;
  if (!lines) {
    if (shown) {
      await Promise.all(glance.map(item => menu.remove(item)));
    }
    await icon.setTooltip("Piéride");
    return;
  }
  await glance[0].setText(lines[0]);
  await glance[1].setText(lines[1]);
  if (!shown) {
    await menu.prepend(glance);
  }
  await icon.setTooltip(`Piéride\n${lines.join("\n")}`);
}
