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
  Menu,
  Palette,
  Paper,
  User,
} from "@getpapillon/papicons";
import { type ComponentType, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { WindowControls } from "@/app/layout/WindowControls";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import type { AccountSummary } from "@/hooks/useAccounts";
import { useModalDialog } from "@/hooks/useModalDialog";

import { AppearanceSettings } from "./AppearanceSettings";
import { DeveloperSettings } from "./DeveloperSettings";
import { LanguageSettings } from "./LanguageSettings";
import styles from "./settings.module.scss";
import { SidebarSettings } from "./SidebarSettings";

export interface SettingsSectionProps {
  account: AccountSummary | undefined;
}

interface Section {
  /** Clés i18n `settings.sections.<id>` et `settings.descriptions.<id>`. */
  id: string;
  icon: typeof Home;
  /** Absent : la page arrive avec une prochaine version (« Bientôt ici »). */
  content?: ComponentType<SettingsSectionProps>;
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
      { id: "account", icon: User },
      { id: "linkedAccounts", icon: Link },
    ],
  },
  {
    id: "appearance",
    sections: [
      APPEARANCE,
      { id: "subjects", icon: Emoji },
      { id: "sidebar", icon: Menu, content: SidebarSettings },
    ],
  },
  {
    id: "app",
    sections: [
      { id: "features", icon: Gears },
      { id: "notifications", icon: Bell },
      { id: "language", icon: Globe, content: LanguageSettings },
      { id: "startup", icon: Grid },
    ],
  },
  {
    id: "pieride",
    sections: [
      { id: "privacy", icon: Lock },
      { id: "releaseNotes", icon: Paper },
      { id: "about", icon: Info },
      // En dev seulement : l'app publiée affiche « Bientôt ici » et ne contient pas la page.
      {
        id: "developer",
        icon: Code,
        content: import.meta.env.DEV ? DeveloperSettings : undefined,
      },
    ],
  },
];

export function Settings({
  open,
  onClose,
  account,
}: {
  open: boolean;
  onClose: () => void;
  account: AccountSummary | undefined;
}) {
  const { t } = useTranslation();
  const dialog = useModalDialog(open);
  const [active, setActive] = useState(APPEARANCE);
  const activeButton = useRef<HTMLButtonElement>(null);
  // À l'ouverture, le focus va à la catégorie affichée plutôt qu'à la première.
  useEffect(() => {
    if (open) {
      activeButton.current?.focus();
    }
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={styles.settings}
      aria-label={t("settings.title")}
      onClose={onClose}
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
      </nav>

      <div className={styles.panel}>
        <WindowControls />
        <div className={styles.content}>
          <header className={styles.header} data-tauri-drag-region>
            <div>
              <h2 className={styles.heading}>
                {t(`settings.sections.${active.id}`)}
              </h2>
              {active.content && (
                <p className={styles.description}>
                  {t(`settings.descriptions.${active.id}`)}
                </p>
              )}
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
          {active.content ? (
            <active.content account={account} />
          ) : (
            <div className={styles.card}>
              <EmptyState
                icon={active.icon}
                title={t("placeholder.title")}
                text={t("placeholder.text")}
              />
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
