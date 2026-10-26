import { useEffect, useRef } from "react";

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
