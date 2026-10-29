// Ajouter un compte depuis Paramètres > Comptes liés : les étapes « service scolaire » et
// « compte hors ligne » du premier lancement, dans une boîte de dialogue. Les connexions aux
// services arrivent avec eux (PRONOTE en M3).
import { Cross } from "@getpapillon/papicons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { OfflineAccountStep } from "@/app/onboarding/OfflineAccountStep";
import { ServiceStep } from "@/app/onboarding/ServiceStep";
import { onOwnClose, useModalDialog } from "@/hooks/useModalDialog";

import styles from "./settings.module.scss";

/** `start` : l'étape d'ouverture, `null` quand la fenêtre est fermée. */
export function AddAccountDialog({
  start,
  onClose,
}: {
  start: "service" | "offline" | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const dialog = useModalDialog(start !== null);
  const [offline, setOffline] = useState(false);
  const close = () => {
    setOffline(false);
    onClose();
  };

  return (
    <dialog
      ref={dialog}
      className={styles.addAccount}
      aria-label={t("settings.linked.addAccount")}
      onClose={onOwnClose(close)}
    >
      <button
        type="button"
        className={styles.dialogClose}
        aria-label={t("dialog.close")}
        onClick={close}
      >
        <Cross size={18} />
      </button>
      {start === "offline" || (start === "service" && offline) ? (
        <OfflineAccountStep
          onCancel={start === "offline" ? close : () => setOffline(false)}
          onCreated={close}
        />
      ) : (
        start === "service" && (
          <ServiceStep onOffline={() => setOffline(true)} />
        )
      )}
    </dialog>
  );
}
