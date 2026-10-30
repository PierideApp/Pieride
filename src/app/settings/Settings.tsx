// Paramètres (UX §5 et §6) : superposition plein écran comme les réglages de Discord, catégories
// à gauche, `Échap` pour fermer. `<dialog>` modal : le reste de l'app est inerte derrière.
// Catégories des maquettes (pieride_design/design/07-parametres).
import {
  Bell,
  Code,
  Cross,
  Emoji,
  Gears,
  Globe,
  Grid,
  type Home,
  Info,
  Link,
  Lock,
  Logout,
  Menu,
  Palette,
  Paper,
  User,
} from "@getpapillon/papicons";
import { type ComponentType, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { WindowControls } from "@/app/layout/WindowControls";
import { ConfirmDialog } from "@/components/ConfirmDialog/ConfirmDialog";
import type { AccountSummary } from "@/hooks/useAccounts";
import { onOwnClose, useModalDialog } from "@/hooks/useModalDialog";
import { report } from "@/lib/log";
import { removeAccount } from "@/stores/accounts";
import { useSettingsDialog } from "@/stores/settingsDialog";

import { AboutSettings } from "./AboutSettings";
import { AccountSettings } from "./AccountSettings";
import { AppearanceSettings } from "./AppearanceSettings";
import { DeveloperSettings } from "./DeveloperSettings";
import { FeaturesSettings } from "./FeaturesSettings";
import { LanguageSettings } from "./LanguageSettings";
import { LinkedAccountsSettings } from "./LinkedAccountsSettings";
import { NotificationsSettings } from "./NotificationsSettings";
import { PrivacySettings } from "./PrivacySettings";
import { ReleaseNotesSettings } from "./ReleaseNotesSettings";
import styles from "./settings.module.scss";
import { SidebarSettings } from "./SidebarSettings";
import { StartupSettings } from "./StartupSettings";
import { SubjectsSettings } from "./SubjectsSettings";

export interface SettingsSectionProps {
  /** Le compte affiché dans l'app. */
  account: AccountSummary | undefined;
  accounts: AccountSummary[];
}

interface Section {
  /** Clés i18n `settings.sections.<id>` et `settings.descriptions.<id>`. */
  id: string;
  icon: typeof Home;
  content: ComponentType<SettingsSectionProps>;
}

const APPEARANCE: Section = {
  id: "appearance",
  icon: Palette,
  content: AppearanceSettings,
};

const GROUPS: readonly { id: string; sections: readonly Section[] }[] = [
  {
    id: "account",
    sections: [
      { id: "account", icon: User, content: AccountSettings },
      { id: "linkedAccounts", icon: Link, content: LinkedAccountsSettings },
    ],
  },
  {
    id: "appearance",
    sections: [
      APPEARANCE,
      { id: "subjects", icon: Emoji, content: SubjectsSettings },
      { id: "sidebar", icon: Menu, content: SidebarSettings },
    ],
  },
  {
    id: "app",
    sections: [
      { id: "features", icon: Gears, content: FeaturesSettings },
      { id: "notifications", icon: Bell, content: NotificationsSettings },
      { id: "language", icon: Globe, content: LanguageSettings },
      { id: "startup", icon: Grid, content: StartupSettings },
    ],
  },
  {
    id: "pieride",
    sections: [
      { id: "privacy", icon: Lock, content: PrivacySettings },
      { id: "releaseNotes", icon: Paper, content: ReleaseNotesSettings },
      { id: "about", icon: Info, content: AboutSettings },
      { id: "developer", icon: Code, content: DeveloperSettings },
    ],
  },
];

export function Settings({
  open,
  onClose,
  account,
  accounts,
}: {
  open: boolean;
  onClose: () => void;
} & SettingsSectionProps) {
  const { t } = useTranslation();
  const dialog = useModalDialog(open);
  // La section demandée par une page (bouton « Fond d'écran » de l'accueil), sinon Personnalisation.
  const [active, setActive] = useState(() => {
    const asked = useSettingsDialog.getState().section;
    return (
      GROUPS.flatMap(group => group.sections).find(
        section => section.id === asked
      ) ?? APPEARANCE
    );
  });
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const activeButton = useRef<HTMLButtonElement>(null);
  // À l'ouverture, le focus va à la catégorie affichée plutôt qu'à la première.
  useEffect(() => {
    if (open) {
      activeButton.current?.focus();
    }
  }, [open]);

  // Les zones vides du haut déplacent la fenêtre (`data-tauri-drag-region`) : le titre de la
  // colonne, la barre du panneau et les marges autour de lui.
  return (
    <dialog
      ref={dialog}
      className={styles.settings}
      aria-label={t("settings.title")}
      onClose={onOwnClose(onClose)}
      data-tauri-drag-region
    >
      <nav className={styles.nav} aria-label={t("settings.title")}>
        <h1 className={styles.title} data-tauri-drag-region>
          {t("settings.title")}
        </h1>
        {GROUPS.map(group => (
          <div
            key={group.id}
            role="group"
            aria-labelledby={`settings-${group.id}`}
          >
            <p id={`settings-${group.id}`} className={styles.group}>
              {t(`settings.groups.${group.id}`)}
            </p>
            {group.sections.map(section => (
              <button
                key={section.id}
                ref={section === active ? activeButton : undefined}
                type="button"
                className={
                  section === active
                    ? `${styles.item} ${styles.active}`
                    : styles.item
                }
                aria-current={section === active || undefined}
                onClick={() => setActive(section)}
              >
                <section.icon size={20} className={styles.itemIcon} />
                {t(`settings.sections.${section.id}`)}
              </button>
            ))}
          </div>
        ))}
        {account && (
          <button
            type="button"
            className={`${styles.item} ${styles.signOut}`}
            onClick={() => {
              setSignOutFailed(false);
              setSigningOut(true);
            }}
          >
            <Logout size={20} className={styles.itemIcon} />
            {t("settings.signOut.label")}
          </button>
        )}
      </nav>

      <div className={styles.panel}>
        <div className={styles.dragBar} data-tauri-drag-region />
        <WindowControls />
        <div className={styles.content}>
          <header className={styles.header} data-tauri-drag-region>
            <div>
              <h2 className={styles.heading}>
                {t(`settings.sections.${active.id}`)}
              </h2>
              <p className={styles.description}>
                {t(`settings.descriptions.${active.id}`)}
              </p>
            </div>
            <button
              type="button"
              className={styles.close}
              aria-label={t("settings.close")}
              onClick={onClose}
            >
              <Cross size={18} />
              <kbd>{t("keys.escape")}</kbd>
            </button>
          </header>
          <active.content account={account} accounts={accounts} />
        </div>
      </div>

      {/* Se déconnecter : retire le compte affiché de cet ordinateur. */}
      <ConfirmDialog
        open={signingOut}
        title={t("settings.signOut.title", {
          name: `${account?.firstName ?? ""} ${account?.lastName ?? ""}`,
        })}
        text={t("settings.linked.removeText")}
        confirm={t("settings.signOut.label")}
        danger
        onCancel={() => setSigningOut(false)}
        onConfirm={() => {
          if (!account) {
            return;
          }
          // Un secret resté dans le trousseau est retenté au prochain démarrage.
          removeAccount(account.id).then(
            () => {
              setSigningOut(false);
              onClose();
            },
            (failure: unknown) => {
              report("settings", failure);
              setSignOutFailed(true);
            }
          );
        }}
      >
        {signOutFailed && (
          <p className={styles.error} role="alert">
            {t("settings.linked.failed")}
          </p>
        )}
      </ConfirmDialog>
    </dialog>
  );
}
