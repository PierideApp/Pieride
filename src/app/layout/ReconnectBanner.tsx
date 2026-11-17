// Une carte en haut de la page, comme celles de l'accueil, tant qu'un service est à reconnecter :
// pourquoi, et la reconnexion à un clic (Papillon montre de même une alerte à l'accueil). Le
// compte affiché passe avant les autres.
import { AlertTriangle } from "@getpapillon/papicons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Relink } from "@/app/onboarding/pronote/ConnectStep";
import { AddAccountDialog, relinkOf } from "@/app/settings/AddAccountDialog";
import { Button } from "@/components/Button/Button";
import type { AccountSummary } from "@/hooks/useAccounts";
import { SERVICE_NAMES } from "@/services/shared/plugin";

import styles from "./layout.module.scss";
import { reasonOf, refusedServices } from "./reconnect";

export function ReconnectBanner({
  accounts,
  currentId,
}: {
  accounts: readonly AccountSummary[];
  currentId: string | undefined;
}) {
  const { t } = useTranslation();
  /** Gardée à part : la fenêtre reste ouverte même quand la carte disparaît. */
  const [relinking, setRelinking] = useState<Relink | null>(null);
  const [first] = refusedServices(accounts, currentId);
  const relink = first ? relinkOf(first.account) : null;
  const service = first ? SERVICE_NAMES[first.service.kind] : "";
  const reason = first ? reasonOf(first.service) : "expired";

  return (
    <>
      {first && (
        <div className={styles.reconnect} role="status">
          <span aria-hidden="true">
            <AlertTriangle size={20} />
          </span>
          <strong>
            {first.account.id === currentId
              ? t(`reconnect.${reason}.title`, { service })
              : t("reconnect.other", {
                  name: first.account.firstName,
                  service,
                })}
          </strong>
          <small>{t(`reconnect.${reason}.text`)}</small>
          {relink && (
            <Button variant="primary" onClick={() => setRelinking(relink)}>
              {t("reconnect.action")}
            </Button>
          )}
        </div>
      )}
      <AddAccountDialog start={relinking} onClose={() => setRelinking(null)} />
    </>
  );
}
