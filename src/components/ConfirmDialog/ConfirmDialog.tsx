// Boîte de dialogue de confirmation (UX §5, deuxième niveau de fenêtre) : une question, une
// phrase, Annuler ou confirmer. `Échap` annule.
import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button/Button";
import { useModalDialog } from "@/hooks/useModalDialog";

import styles from "./ConfirmDialog.module.scss";

export function ConfirmDialog({
  open,
  title,
  text,
  confirm,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  text: string;
  /** Libellé du bouton de confirmation. */
  confirm: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Sous la phrase : une erreur, un détail. */
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const dialog = useModalDialog(open);
  const titleId = useId();
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={onCancel}
    >
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      <p className={styles.text}>{text}</p>
      {children}
      <footer className={styles.footer}>
        <Button onClick={onCancel}>{t("dialog.cancel")}</Button>
        <Button
          variant={danger ? "dangerSolid" : "primary"}
          disabled={busy}
          onClick={onConfirm}
        >
          {confirm}
        </Button>
      </footer>
    </dialog>
  );
}
