// Le compte affiché. Les comptes eux-mêmes sont dans la base (AccountManager), leurs secrets
// dans le trousseau : ici, seulement l'`id` du compte en cours.
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AccountState {
  currentAccountId: string | null;
  setCurrentAccount: (id: string | null) => void;
}

export const useAccountStore = create<AccountState>()(
  persist(
    set => ({
      currentAccountId: null,
      setCurrentAccount: id => set({ currentAccountId: id }),
    }),
    { name: "pieride-account" }
  )
);
