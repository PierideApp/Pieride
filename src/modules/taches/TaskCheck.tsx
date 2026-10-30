// Case ronde d'un devoir (maquettes : `check`) : pleine de la couleur de la matière quand il est
// fait. Un clic le coche ou le décoche.
import { Check } from "@getpapillon/papicons";
import { useTranslation } from "react-i18next";

import type { HomeworkView } from "@/hooks/useHomework";

import styles from "./taches.module.scss";

export function TaskCheck({
  item,
  busy,
  size = 22,
  onToggle,
}: {
  item: HomeworkView;
  /** Envoi en cours au service. */
  busy: boolean;
  size?: 22 | 24;
  onToggle: (item: HomeworkView) => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={styles.check}
      data-size={size}
      data-done={item.done || undefined}
      aria-pressed={item.done}
      aria-label={t("taches.markDone")}
      disabled={busy}
      onClick={() => onToggle(item)}
    >
      {item.done && <Check size={size * 0.6} aria-hidden="true" />}
    </button>
  );
}
