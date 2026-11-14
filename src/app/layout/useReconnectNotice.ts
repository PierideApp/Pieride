// Une notification du système quand un service passe à « reconnexion nécessaire » : l'app tourne
// souvent réduite dans la barre des tâches, où le bandeau des pages ne se voit pas. Une fois par
// refus ; sans permission, rien (la demander ici surprendrait).
import {
  isPermissionGranted,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import type { AccountSummary } from "@/hooks/useAccounts";
import type { Loaded } from "@/hooks/useLoaded";
import { report } from "@/lib/log";
import { SERVICE_NAMES } from "@/services/shared/plugin";

import { newlyRefused, refusedServices } from "./reconnect";

/** Les services refusés à la dernière lecture ; `null` avant la première du lancement. */
let known: Set<string> | null = null;

export function useReconnectNotice(accounts: Loaded<AccountSummary[]>) {
  const { t } = useTranslation();
  useEffect(() => {
    if (accounts.status !== "ready") {
      return;
    }
    const refused = refusedServices(accounts.data, undefined);
    const fresh = newlyRefused(known, refused);
    // Un service reconnecté sort de la liste : un refus plus tard sera annoncé de nouveau.
    known = new Set(refused.map(({ service }) => service.id));
    if (fresh.length === 0) {
      return;
    }
    isPermissionGranted()
      .then(granted => {
        for (const { account, service } of granted ? fresh : []) {
          sendNotification({
            title: t("reconnect.notification.title", {
              service: SERVICE_NAMES[service.kind],
            }),
            body: t("reconnect.notification.body", {
              name: account.firstName,
            }),
          });
        }
      })
      // Un code d'erreur du système, jamais une donnée.
      .catch((error: unknown) => report("sync", error));
  }, [accounts, t]);
}
