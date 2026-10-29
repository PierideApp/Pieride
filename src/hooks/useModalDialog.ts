import { type SyntheticEvent, useEffect, useRef } from "react";

/**
 * Ouvre ou ferme un `<dialog>` modal selon `open`. Le navigateur garde le focus dedans, rend
 * le reste de la page inerte et ferme avec `Échap` (événement `close`).
 */
export function useModalDialog(open: boolean) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (open && !element?.open) {
      element?.showModal();
    } else if (!open && element?.open) {
      element.close();
    }
  }, [open]);
  return dialog;
}

/**
 * Le `onClose` d'un `<dialog>`, sans la fermeture d'un `<dialog>` ouvert dedans (confirmation
 * dans les Paramètres) : le navigateur ne fait pas remonter `close`, mais React si, à travers
 * l'arbre des composants, et les Paramètres se fermaient avec leur confirmation.
 */
export function onOwnClose(handler: () => void) {
  return (event: SyntheticEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) {
      handler();
    }
  };
}
