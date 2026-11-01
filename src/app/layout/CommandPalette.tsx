// Palette de commandes (UX §5, `Ctrl/⌘ K`) : aller à un module, ouvrir une tâche, une note, un
// cours ou une actualité déjà enregistrés (paletteSearch), une section des Paramètres,
// synchroniser, changer de compte.
// `<dialog>` natif : focus gardé dans la palette, `Échap` et fond assombri fournis.
import { Check, Gears, type Home, Search, User } from "@getpapillon/papicons";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";

import { SETTINGS_SECTIONS } from "@/app/settings/Settings";
import type { AccountSummary } from "@/hooks/useAccounts";
import { capitalize, useDateFormats } from "@/hooks/useFormats";
import { type Jump, jumpTo } from "@/hooks/useJump";
import { onOwnClose, useModalDialog } from "@/hooks/useModalDialog";
import { useNow } from "@/hooks/useNow";
import { useScore } from "@/hooks/useScore";
import { EMPTY_INDEX, useSearchIndex } from "@/hooks/useSearchIndex";
import { onTwenty } from "@/lib/grades";
import { MOD } from "@/lib/platform";
import { matches } from "@/lib/search";
import { addDays, sameDay } from "@/lib/week";
import { type ModuleManifest, modulePath } from "@/modules/registry";
import { useAccountStore } from "@/stores/accounts";
import { useSettingsDialog } from "@/stores/settingsDialog";

import styles from "./layout.module.scss";
import { MIN_LENGTH, searchIndex } from "./paletteSearch";

export interface Command {
  id: string;
  /** `goto`, `settings`, `actions`, ou le module d'où vient l'élément (`taches`…). */
  group: string;
  title: string;
  subtitle?: string;
  /** Cherché en plus du titre et du sous-titre, sans être affiché. */
  keywords?: string;
  icon: typeof Home;
  keys?: string[];
  run: () => void;
}

/** Chaque mot tapé doit se trouver dans le titre, le sous-titre ou les mots-clés. */
export function filterCommands(
  commands: readonly Command[],
  query: string
): Command[] {
  return commands.filter(command =>
    matches(
      `${command.title} ${command.subtitle ?? ""} ${command.keywords ?? ""}`,
      query
    )
  );
}

export function CommandPalette({
  open,
  onClose,
  modules,
  accounts,
  current,
  onSync,
  onSettings,
}: {
  open: boolean;
  onClose: () => void;
  modules: readonly ModuleManifest[];
  accounts: readonly AccountSummary[];
  current: AccountSummary | undefined;
  onSync: () => void;
  onSettings: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const setCurrent = useAccountStore(state => state.setCurrentAccount);
  const showSettings = useSettingsDialog(state => state.show);
  const formats = useDateFormats();
  const score = useScore();
  const now = useNow();
  const stored = useSearchIndex(open ? current?.id : undefined);
  const commands = useMemo<Command[]>(
    () => [
      ...modules.map((module, index) => ({
        id: `goto-${module.id}`,
        group: "goto",
        title: t(`modules.${module.id}`),
        icon: module.icon,
        keys: [MOD, String(index + 1)],
        run: () => void navigate(modulePath(module)),
      })),
      ...(current
        ? [
            {
              id: "sync",
              group: "actions",
              title: t("palette.sync"),
              icon: Check,
              keys: [MOD, "R"],
              run: onSync,
            },
          ]
        : []),
      ...accounts
        .filter(account => account.id !== current?.id)
        .map(account => ({
          id: `account-${account.id}`,
          group: "actions",
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
        group: "actions",
        title: t("settings.title"),
        icon: Gears,
        keys: [MOD, ","],
        run: onSettings,
      },
    ],
    [modules, current, accounts, t, navigate, onSync, onSettings, setCurrent]
  );
  // Proposées seulement à la recherche : sans elle, toutes les sections noieraient le reste.
  const sections = useMemo<Command[]>(
    () =>
      SETTINGS_SECTIONS.map(section => ({
        id: `settings-${section.id}`,
        group: "settings",
        title: t(`settings.sections.${section.id}`),
        subtitle: t("settings.title"),
        keywords: t(`settings.descriptions.${section.id}`),
        icon: section.icon,
        run: () => showSettings(pathname, { section: section.id }),
      })),
    [t, showSettings, pathname]
  );
  const dialog = useModalDialog(open);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const found = useMemo(
    () =>
      searchIndex(
        stored.status === "ready" ? stored.data : EMPTY_INDEX,
        query,
        now
      ),
    [stored, query, now]
  );

  // « pour demain », sinon « pour le 12 oct. » : la palette cherche dans toutes les semaines.
  const due = (date: Date) =>
    [-1, 0, 1].some(offset => sameDay(date, addDays(now, offset)))
      ? t("palette.dueNear", { day: formats.relativeDay(date, now) })
      : t("palette.dueDate", { date: formats.shortDate.format(date) });
  // Dans l'ordre de la barre latérale ; un module masqué ne propose rien.
  const data = modules.flatMap((module): Command[] => {
    const go = (jump: Jump) => () =>
      void navigate(modulePath(module), { state: jumpTo(jump) });
    const shared = { group: module.id, icon: module.icon };
    switch (module.id) {
      case "taches":
        return found.homework.map(item => ({
          ...shared,
          id: `taches-${item.serviceId}-${item.id}`,
          title: item.content || item.label,
          subtitle: `${item.label} · ${due(item.dueAt)}`,
          run: go({
            serviceId: item.serviceId,
            id: item.id,
            at: item.dueAt.getTime(),
          }),
        }));
      case "notes":
        return found.grades.map(grade => ({
          ...shared,
          id: `notes-${grade.serviceId}-${grade.id}`,
          title: grade.title || grade.label,
          // « 16,00/20 », ou le statut seul (« Abs. ») pour une note sans points.
          subtitle: [
            grade.label,
            onTwenty(grade) === undefined
              ? grade.status
              : `${score.grade(grade)}/${score.scale}`,
          ]
            .filter(Boolean)
            .join(" · "),
          run: go({
            serviceId: grade.serviceId,
            id: grade.id,
            at: grade.date.getTime(),
            periodId: grade.periodId,
          }),
        }));
      case "cours":
        return found.courses.map(course => ({
          ...shared,
          id: `cours-${course.serviceId}-${course.id}`,
          title: course.label,
          subtitle: [
            capitalize(formats.longDate.format(course.from), formats.locale),
            formats.time.format(course.from),
            course.room,
          ]
            .filter(Boolean)
            .join(" · "),
          run: go({
            serviceId: course.serviceId,
            id: course.id,
            at: course.from.getTime(),
          }),
        }));
      case "actualites":
        return found.news.map(item => ({
          ...shared,
          id: `actualites-${item.serviceId}-${item.id}`,
          title: item.title ?? t("actualites.untitled"),
          subtitle: `${item.author} · ${formats.shortDate.format(item.date)}`,
          run: go({
            serviceId: item.serviceId,
            id: item.id,
            at: item.date.getTime(),
          }),
        }));
      default:
        return [];
    }
  });
  const searching = query.trim().length >= MIN_LENGTH;
  const reading = searching && stored.fetching && data.length === 0;
  const groups = [
    "goto",
    ...modules.map(module => module.id),
    "settings",
    "actions",
  ];
  const matched = [
    ...filterCommands(
      query.trim() ? [...commands, ...sections] : commands,
      query
    ),
    ...data,
  ];
  // Rangés groupe par groupe : les flèches suivent l'ordre affiché.
  const results = groups.flatMap(group =>
    matched.filter(command => command.group === group)
  );
  const activeId = results[active]?.id;

  useEffect(() => {
    document
      .getElementById(`command-${activeId}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  const groupLabel = (group: string) =>
    group === "goto" || group === "actions"
      ? t(`palette.${group}`)
      : group === "settings"
        ? t("settings.title")
        : t(`modules.${group}`);
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
          aria-activedescendant={activeId ? `command-${activeId}` : undefined}
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
        {results.length === 0 && !reading && (
          <p className={styles.paletteEmpty}>{t("palette.empty")}</p>
        )}
        {groups.map(group => {
          const items = results.filter(command => command.group === group);
          return (
            items.length > 0 && (
              <div key={group} role="group" aria-label={groupLabel(group)}>
                <p className={styles.paletteGroup}>{groupLabel(group)}</p>
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
                      {command.keys ? (
                        <span className={styles.paletteKeys}>
                          {command.keys.map(key => (
                            <kbd key={key}>{key}</kbd>
                          ))}
                        </span>
                      ) : (
                        index === active && (
                          <span className={styles.paletteHint}>
                            {t("palette.openHint")}
                          </span>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            )
          );
        })}
        {reading && (
          <p className={styles.paletteNote}>{t("palette.loading")}</p>
        )}
        {searching && stored.status === "error" && (
          <p className={styles.paletteNote} role="alert">
            {t("palette.unavailable")}
          </p>
        )}
      </div>

      <footer className={styles.paletteFooter}>
        <kbd>↑↓</kbd> {t("palette.navigate")} <kbd>{t("keys.enter")}</kbd>{" "}
        {t("palette.open")} <kbd>{t("keys.escape")}</kbd> {t("palette.close")}
      </footer>
    </dialog>
  );
}
