// Palette de commandes (UX §5, `Ctrl/⌘ K`) : aller à un module, changer de compte, ouvrir les
// Paramètres.
// Elle cherchera aussi dans les notes, tâches et cours quand leurs écrans existeront (M3).
// `<dialog>` natif : focus gardé dans la palette, `Échap` et fond assombri fournis.
import { Gears, type Home, Search, User } from "@getpapillon/papicons";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import type { AccountSummary } from "@/hooks/useAccounts";
import { onOwnClose, useModalDialog } from "@/hooks/useModalDialog";
import { MOD } from "@/lib/platform";
import { type ModuleManifest, modulePath } from "@/modules/registry";
import { useAccountStore } from "@/stores/accounts";

import styles from "./layout.module.scss";

export interface Command {
  id: string;
  group: "goto" | "actions";
  title: string;
  subtitle?: string;
  icon: typeof Home;
  keys?: string[];
  run: () => void;
}

const GROUPS = ["goto", "actions"] as const;

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Chaque mot tapé doit se trouver dans le titre ou le sous-titre, accents ignorés. */
export function filterCommands(
  commands: readonly Command[],
  query: string
): Command[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return commands.filter(command => {
    const text = normalize(`${command.title} ${command.subtitle ?? ""}`);
    return words.every(word => text.includes(word));
  });
}

export function CommandPalette({
  open,
  onClose,
  modules,
  accounts,
  current,
  onSettings,
}: {
  open: boolean;
  onClose: () => void;
  modules: readonly ModuleManifest[];
  accounts: readonly AccountSummary[];
  current: AccountSummary | undefined;
  onSettings: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setCurrent = useAccountStore(state => state.setCurrentAccount);
  const commands = useMemo<Command[]>(
    () => [
      ...modules.map((module, index) => ({
        id: `goto-${module.id}`,
        group: "goto" as const,
        title: t(`modules.${module.id}`),
        icon: module.icon,
        keys: [MOD, String(index + 1)],
        run: () => void navigate(modulePath(module)),
      })),
      ...accounts
        .filter(account => account.id !== current?.id)
        .map(account => ({
          id: `account-${account.id}`,
          group: "actions" as const,
          title: t("palette.switchAccount"),
          subtitle: [
            `${account.firstName} ${account.lastName}`,
            account.schoolName,
          ]
            .filter(Boolean)
            .join(" · "),
          icon: User,
          run: () => setCurrent(account.id),
        })),
      {
        id: "settings",
        group: "actions" as const,
        title: t("settings.title"),
        icon: Gears,
        keys: [MOD, ","],
        run: onSettings,
      },
    ],
    [modules, current, accounts, t, navigate, onSettings, setCurrent]
  );
  const dialog = useModalDialog(open);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = useMemo(
    () => filterCommands(commands, query),
    [commands, query]
  );

  useEffect(() => {
    document
      .getElementById(`command-${results[active]?.id}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, results]);

  const close = () => {
    setQuery("");
    setActive(0);
    onClose();
  };
  const run = (command: Command | undefined) => {
    if (command) {
      close();
      command.run();
    }
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive(index =>
        Math.min(Math.max(index + step, 0), results.length - 1)
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(results[active]);
    }
  };

  return (
    <dialog
      ref={dialog}
      className={styles.palette}
      aria-label={t("palette.label")}
      onClose={onOwnClose(close)}
      onClick={event => event.target === dialog.current && close()}
    >
      <div className={styles.paletteSearch}>
        <Search size={20} className={styles.paletteSearchIcon} />
        <input
          role="combobox"
          aria-expanded="true"
          aria-controls="command-list"
          aria-activedescendant={
            results[active] ? `command-${results[active].id}` : undefined
          }
          placeholder={t("palette.placeholder")}
          value={query}
          onChange={event => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        <kbd>{t("keys.escape")}</kbd>
      </div>

      <div id="command-list" role="listbox" className={styles.paletteList}>
        {results.length === 0 && (
          <p className={styles.paletteEmpty}>{t("palette.empty")}</p>
        )}
        {GROUPS.map(group => {
          const items = results.filter(command => command.group === group);
          return (
            items.length > 0 && (
              <div key={group} role="group" aria-label={t(`palette.${group}`)}>
                <p className={styles.paletteGroup}>{t(`palette.${group}`)}</p>
                {items.map(command => {
                  const index = results.indexOf(command);
                  return (
                    <div
                      key={command.id}
                      id={`command-${command.id}`}
                      role="option"
                      aria-selected={index === active}
                      className={styles.paletteItem}
                      onMouseMove={() => setActive(index)}
                      onClick={() => run(command)}
                    >
                      <span className={styles.paletteIcon} aria-hidden="true">
                        <command.icon size={18} />
                      </span>
                      <span className={styles.paletteText}>
                        <strong>{command.title}</strong>
                        {command.subtitle && <small>{command.subtitle}</small>}
                      </span>
                      {command.keys && (
                        <span className={styles.paletteKeys}>
                          {command.keys.map(key => (
                            <kbd key={key}>{key}</kbd>
                          ))}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          );
        })}
      </div>

      <footer className={styles.paletteFooter}>
        <kbd>↑↓</kbd> {t("palette.navigate")} <kbd>{t("keys.enter")}</kbd>{" "}
        {t("palette.open")} <kbd>{t("keys.escape")}</kbd> {t("palette.close")}
      </footer>
    </dialog>
  );
}
