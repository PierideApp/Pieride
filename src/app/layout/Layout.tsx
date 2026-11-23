// Le cadre de la fenêtre (UX §3) : barre latérale, boutons de la fenêtre, page du module affiché,
// panneau détail, palette de commandes et Paramètres.
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Route, Routes, useLocation } from "react-router";

import { Settings } from "@/app/settings/Settings";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import { ErrorBoundary } from "@/components/ErrorBoundary/ErrorBoundary";
import { Page } from "@/components/Page/Page";
import type { AccountSummary } from "@/hooks/useAccounts";
import { useAutoUpdate } from "@/hooks/useAutoUpdate";
import type { Loaded } from "@/hooks/useLoaded";
import { useShortcuts } from "@/hooks/useShortcuts";
import { useTrayGlance } from "@/hooks/useTrayGlance";
import {
  modulePath,
  syncedCapabilities,
  visibleModules,
} from "@/modules/registry";
import { SYNC_INTERVAL } from "@/services/account-manager";
import { capabilitiesOf } from "@/services/shared/plugin";
import { useAccountStore } from "@/stores/accounts";
import { useDetailStore } from "@/stores/detail";
import { useSettingsStore } from "@/stores/settings";
import { useSettingsDialog } from "@/stores/settingsDialog";
import { type SyncTarget, useSyncStore } from "@/stores/sync";

import { CommandPalette } from "./CommandPalette";
import { DetailPanel } from "./DetailPanel";
import styles from "./layout.module.scss";
import { NotFound } from "./NotFound";
import { ReconnectBanner } from "./ReconnectBanner";
import { Sidebar } from "./Sidebar";
import { useReconnectNotice } from "./useReconnectNotice";
import { WhatsNewDialog } from "./WhatsNewDialog";
import { WindowControls } from "./WindowControls";

export function Layout({ accounts }: { accounts: Loaded<AccountSummary[]> }) {
  const { t } = useTranslation();
  const currentId = useAccountStore(state => state.currentAccountId);
  const detailOpen = useDetailStore(state => state.content !== null);
  const closeDetail = useDetailStore(state => state.close);
  const { pathname } = useLocation();
  useAutoUpdate();
  useReconnectNotice(accounts);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Ouverts sur la page en cours : changer de page (raccourci, palette) les ferme.
  const settingsAt = useSettingsDialog(state => state.openAt);
  const settingsRequest = useSettingsDialog(state => state.request);
  const showSettings = useSettingsDialog(state => state.show);
  const closeSettings = useSettingsDialog(state => state.close);
  const list = useMemo(
    () => (accounts.status === "ready" ? accounts.data : []),
    [accounts]
  );
  const current = list.find(account => account.id === currentId) ?? list[0];
  const hiddenModules = useSettingsStore(state => state.hiddenModules);
  const hidden = current ? hiddenModules[current.id] : undefined;
  const order = useSettingsStore(state =>
    current ? state.moduleOrder[current.id] : undefined
  );
  const autoCollapse = useSettingsStore(state => state.sidebarAutoCollapse);
  const modules = useMemo(
    () => visibleModules(capabilitiesOf(current?.kinds ?? []), hidden, order),
    [current, hidden, order]
  );
  const synced = useMemo(() => syncedCapabilities(modules), [modules]);
  const sync = useSyncStore(state => state.sync);
  const syncNow = useSyncStore(state => state.syncNow);
  const syncing = useSyncStore(state => state.syncing);
  const currentAccountId = current?.id;
  // Tous les comptes, l'affiché d'abord : PRONOTE ne renouvelle le jeton qu'à la connexion, un
  // compte qu'on n'ouvre jamais le laisserait expirer. Chacun avec ses modules affichés.
  const targets: SyncTarget[] = (
    current ? [current, ...list.filter(account => account !== current)] : []
  ).map(account => ({
    accountId: account.id,
    capabilities: syncedCapabilities(
      visibleModules(capabilitiesOf(account.kinds), hiddenModules[account.id])
    ),
  }));
  // En chaîne, pour que la relecture des comptes après chaque synchro n'en relance pas une.
  const plan = targets
    .map(({ accountId, capabilities }) => `${accountId}:${capabilities.join()}`)
    .join(" ");
  const syncAll = useEffectEvent(() => void sync(targets));
  // Au lancement, au changement de compte et quand un module est masqué ou réaffiché. Une
  // donnée de moins de 30 minutes n'est pas redemandée (`SYNC_INTERVAL`).
  useEffect(() => {
    if (plan) {
      syncAll();
    }
  }, [plan]);
  // Puis 30 minutes après la fin de chaque synchro, tant que l'app est ouverte. Compter depuis
  // la fin plutôt qu'à heure fixe : la suivante trouve toujours ses données assez vieilles.
  useEffect(() => {
    if (syncing || !plan) {
      return;
    }
    const timer = setTimeout(() => syncAll(), SYNC_INTERVAL);
    return () => clearTimeout(timer);
  }, [syncing, plan]);
  // `Ctrl R`, seule synchro à la demande : au plus toutes les 5 minutes (`syncNow`).
  const syncManually = useCallback(() => {
    if (currentAccountId) {
      syncNow({ accountId: currentAccountId, capabilities: synced });
    }
  }, [currentAccountId, synced, syncNow]);
  // Le détail appartient à la page et au compte affichés : il se ferme quand ils changent.
  // Avant les effets de la nouvelle page, qui peut en ouvrir un tout de suite (palette, `useJump`).
  useLayoutEffect(
    () => closeDetail(),
    [pathname, currentAccountId, closeDetail]
  );

  // Le coup d'œil lit les cours : Cours masqué, ils ne sont plus mis à jour.
  useTrayGlance(
    modules.some(module => module.id === "cours") ? currentAccountId : undefined
  );

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const openSettings = useCallback(
    () => showSettings(pathname),
    [showSettings, pathname]
  );
  useShortcuts(modules, {
    sync: syncManually,
    palette: openPalette,
    settings: openSettings,
  });

  // `data-expanded` : barre latérale complète à toutes les largeurs (pas de rail).
  return (
    <div
      className={styles.shell}
      data-expanded={autoCollapse ? undefined : true}
    >
      <Sidebar
        accounts={accounts}
        current={current}
        modules={modules}
        onSearch={openPalette}
        onSettings={openSettings}
      />
      <WindowControls />
      <main className={styles.page} data-detail-open={detailOpen || undefined}>
        <div className={styles.pageContent}>
          <Routes>
            {modules.map(module => (
              <Route
                key={module.id}
                path={modulePath(module)}
                element={
                  <ErrorBoundary
                    key={module.id}
                    fallback={retry => (
                      <Page title={t(`modules.${module.id}`)}>
                        <EmptyState
                          icon={module.icon}
                          title={t("crash.title")}
                          text={t("crash.text")}
                          action={{ label: t("crash.retry"), onClick: retry }}
                        />
                      </Page>
                    )}
                  >
                    <module.page module={module} />
                  </ErrorBoundary>
                }
              />
            ))}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <ReconnectBanner accounts={list} currentId={currentAccountId} />
        </div>
        <DetailPanel />
      </main>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        modules={modules}
        accounts={list}
        current={current}
        onSync={syncManually}
        onSettings={openSettings}
      />
      <Settings
        // Une section demandée par une page : les Paramètres repartent d'elle.
        key={settingsRequest}
        open={settingsAt === pathname}
        onClose={closeSettings}
        account={current}
        accounts={list}
      />
      <WhatsNewDialog />
    </div>
  );
}
