// Barre latérale (UX §3) : compte, liens des modules du compte, état de la synchronisation,
// Paramètres.
// Sous 1280 px de large, elle devient un rail d'icônes (layout.module.scss), sauf si
// l'utilisateur l'a refusé dans les Paramètres.
import { Check, ChevronDown, Gears, Search } from "@getpapillon/papicons";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

import icon from "@/assets/brand/icon.svg";
import { Avatar } from "@/components/Avatar/Avatar";
import { Spinner } from "@/components/Spinner/Spinner";
import type { AccountSummary } from "@/hooks/useAccounts";
import { useLastSync } from "@/hooks/useLastSync";
import type { Loaded } from "@/hooks/useLoaded";
import { Source, useQuery } from "@/hooks/useQuery";
import { MOD } from "@/lib/platform";
import { type ModuleManifest, modulePath } from "@/modules/registry";
import { MANUAL_SYNC_INTERVAL } from "@/services/account-manager";
import { useAccountStore } from "@/stores/accounts";
import { useSettingsStore } from "@/stores/settings";
import { TOPICS, useSyncStore } from "@/stores/sync";

import styles from "./layout.module.scss";

/** Compte en cours ; menu pour changer s'il y en a plusieurs. */
function AccountSwitcher({
  accounts,
  current,
}: {
  accounts: AccountSummary[];
  current: AccountSummary | undefined;
}) {
  const { t } = useTranslation();
  const setCurrent = useAccountStore(state => state.setCurrentAccount);
  const menu = useRef<HTMLDetailsElement>(null);

  if (!current) {
    return <p className={styles.account}>{t("sidebar.noAccount")}</p>;
  }
  const summary = (
    <>
      <Avatar account={current} />
      <span className={styles.accountText}>
        <strong>
          {current.firstName} {current.lastName}
        </strong>
        {current.schoolName && <small>{current.schoolName}</small>}
      </span>
    </>
  );
  if (accounts.length < 2) {
    return <div className={styles.account}>{summary}</div>;
  }
  return (
    <details ref={menu} className={styles.switcher}>
      <summary
        className={styles.account}
        aria-label={t("sidebar.switchAccount")}
      >
        {summary}
        <ChevronDown size={16} className={styles.chevron} />
      </summary>
      <ul className={styles.accountList}>
        {accounts.map(account => (
          <li key={account.id}>
            <button
              type="button"
              aria-current={account.id === current.id}
              onClick={() => {
                setCurrent(account.id);
                menu.current?.removeAttribute("open");
              }}
            >
              {account.firstName} {account.lastName}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Le refus d'un `Ctrl R` reste affiché ce temps-là, puis l'état revient. */
const REFUSED_NOTICE = 4000;

/**
 * « Synchronisé il y a 2 minutes ». Rien à cliquer : la synchro est automatique, et `Ctrl R`
 * la relance au plus toutes les 5 minutes (« Réessaie dans 3 minutes » sinon).
 */
function SyncStatus({ account }: { account: AccountSummary | undefined }) {
  const { t, i18n } = useTranslation();
  const lastSync = useLastSync(account?.id);
  const syncing = useSyncStore(state => state.syncing);
  const failed = useSyncStore(state => state.failed);
  const manualAt = useSyncStore(state => state.manualAt);
  const refusedAt = useSyncStore(state => state.refusedAt);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (refusedAt === null) {
      return;
    }
    const timer = setTimeout(
      () => setNow(Date.now()),
      refusedAt + REFUSED_NOTICE - Date.now()
    );
    return () => clearTimeout(timer);
  }, [refusedAt]);

  const relative = new Intl.RelativeTimeFormat(i18n.language, {
    numeric: "auto",
  });
  let label = t("sync.never");
  if (syncing) {
    label = t("sync.running");
  } else if (
    manualAt !== null &&
    refusedAt !== null &&
    now < refusedAt + REFUSED_NOTICE
  ) {
    const minutes = Math.ceil(
      (manualAt + MANUAL_SYNC_INTERVAL - refusedAt) / 60_000
    );
    label = t("sync.wait", { when: relative.format(minutes, "minute") });
  } else if (failed || lastSync.status === "error") {
    label = t("sync.failed");
  } else if (lastSync.status === "ready" && lastSync.data) {
    const minutes = Math.round((lastSync.data.getTime() - now) / 60_000);
    label = t("sync.done", { when: relative.format(minutes, "minute") });
  }

  return (
    <p
      className={`${styles.item} ${styles.status}`}
      title={t("sync.hint", { keys: `${MOD} R` })}
    >
      {syncing ? (
        <span className={styles.syncSpinner}>
          <Spinner />
        </span>
      ) : (
        <Check size={20} className={styles.syncIcon} />
      )}
      <span className={styles.label}>{label}</span>
    </p>
  );
}

/** Chaque module compte ce qu'il veut : les pastilles sont relues dès que la base change. */
const badgeCounts = new Source<Map<string, number>>(...TOPICS);

/** Les pastilles des modules qui en ont une. */
function useBadges(
  modules: ModuleManifest[],
  accountId: string | undefined
): Map<string, number> {
  const enabled = useSettingsStore(state => state.sidebarBadges);
  const counted =
    enabled && accountId
      ? modules.flatMap(({ id, badge }) =>
          badge ? [{ id, count: () => badge(accountId) }] : []
        )
      : [];
  const badges = useQuery(
    badgeCounts,
    `${accountId}:${counted.map(({ id }) => id).join()}`,
    async () =>
      new Map(
        await Promise.all(
          counted.map(async ({ id, count }) => [id, await count()] as const)
        )
      )
  );
  return badges.status === "ready" ? badges.data : new Map();
}

function ModuleLinks({
  modules,
  badges,
}: {
  modules: ModuleManifest[];
  badges: Map<string, number>;
}) {
  const { t } = useTranslation();
  return (
    <ul className={styles.links}>
      {modules.map(module => (
        <li key={module.id}>
          <NavLink
            to={modulePath(module)}
            end
            title={t(`modules.${module.id}`)}
            className={({ isActive }) =>
              isActive ? `${styles.item} ${styles.active}` : styles.item
            }
          >
            <module.icon size={20} className={styles.moduleIcon} />
            <span className={styles.label}>{t(`modules.${module.id}`)}</span>
            <Badge count={badges.get(module.id)} />
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

function Badge({ count = 0 }: { count?: number }) {
  return count > 0 ? (
    <span className={styles.badge}>{count > 99 ? "99+" : count}</span>
  ) : null;
}

export function Sidebar({
  accounts,
  current,
  modules,
  onSearch,
  onSettings,
}: {
  accounts: Loaded<AccountSummary[]>;
  current: AccountSummary | undefined;
  modules: ModuleManifest[];
  onSearch: () => void;
  onSettings: () => void;
}) {
  const { t } = useTranslation();
  const school = modules.filter(module => module.group === "school");
  const badges = useBadges(modules, current?.id);
  return (
    <nav className={styles.sidebar} aria-label={t("sidebar.label")}>
      <div className={styles.brand} data-tauri-drag-region>
        <img src={icon} alt="" width={32} height={32} />
        <span className={styles.label}>piéride</span>
      </div>

      {accounts.status === "error" ? (
        <p className={styles.account} role="alert">
          {t("errors.database")}
        </p>
      ) : (
        <AccountSwitcher
          accounts={accounts.status === "ready" ? accounts.data : []}
          current={current}
        />
      )}

      <button
        type="button"
        className={styles.search}
        title={t("palette.search")}
        onClick={onSearch}
      >
        <Search size={16} className={styles.moduleIcon} />
        <span className={styles.label}>{t("palette.search")}</span>
        <kbd className={styles.label}>{MOD} K</kbd>
      </button>

      <ModuleLinks
        modules={modules.filter(module => module.group === "main")}
        badges={badges}
      />
      {school.length > 0 && (
        <>
          <p className={styles.group}>{t("sidebar.school")}</p>
          <ModuleLinks modules={school} badges={badges} />
        </>
      )}

      <div className={styles.footer}>
        <SyncStatus account={current} />
        <button
          type="button"
          className={styles.item}
          title={t("settings.title")}
          onClick={onSettings}
        >
          <Gears size={20} className={styles.moduleIcon} />
          <span className={styles.label}>{t("settings.title")}</span>
        </button>
      </div>
    </nav>
  );
}
