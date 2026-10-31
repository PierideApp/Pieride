// Le compte affiché. Les comptes eux-mêmes sont dans la base (AccountManager), leurs secrets
// dans le trousseau : ici, seulement des `id`.
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { accountManager } from "@/services";

import { useSettingsStore } from "./settings";
import { useSyncStore } from "./sync";

interface AccountState {
  currentAccountId: string | null;
  /** Services supprimés dont le trousseau a refusé d'effacer le secret : retentés au démarrage. */
  orphanSecrets: string[];
  setCurrentAccount: (id: string | null) => void;
}

export const useAccountStore = create<AccountState>()(
  persist(
    set => ({
      currentAccountId: null,
      orphanSecrets: [],
      setCurrentAccount: id => set({ currentAccountId: id }),
    }),
    { name: "pieride-account" }
  )
);

/**
 * Retire un compte et tout ce qui s'y rattache : données, secrets, réglages de la barre
 * latérale. Renvoie faux si un secret est resté dans le trousseau (retenté au démarrage).
 */
export async function removeAccount(accountId: string): Promise<boolean> {
  const failed = await accountManager.removeAccount(accountId);
  useSettingsStore.getState().forgetAccount(accountId);
  useAccountStore.setState(({ currentAccountId, orphanSecrets }) => ({
    currentAccountId: currentAccountId === accountId ? null : currentAccountId,
    orphanSecrets: [...orphanSecrets, ...failed],
  }));
  useSyncStore.getState().reload();
  return failed.length === 0;
}

/** Retente d'effacer les secrets restés dans le trousseau après une suppression. */
export async function forgetOrphanSecrets(): Promise<void> {
  const { orphanSecrets } = useAccountStore.getState();
  if (orphanSecrets.length > 0) {
    const failed = await accountManager.deleteSecrets(orphanSecrets);
    useAccountStore.setState({ orphanSecrets: failed });
  }
}
