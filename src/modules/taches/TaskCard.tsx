// Carte d'un devoir dans le tableau (maquettes : `task_card`) : emoji et matière, échéance,
// consigne, puis le bouton « Terminé ». Un devoir fait est replié sur une ligne. Toute la carte
// ouvre le détail, sauf le bouton qui coche.
import { Check } from "@getpapillon/papicons";
import { useTranslation } from "react-i18next";

import type { HomeworkView } from "@/hooks/useHomework";
import { subjectStyle } from "@/lib/subjects";

import styles from "./taches.module.scss";
import { TaskCheck } from "./TaskCheck";

export function TaskCard({
  item,
  due,
  selected,
  busy,
  onOpen,
  onToggle,
}: {
  item: HomeworkView;
  /** « demain », « lundi »… */
  due: string;
  selected: boolean;
  busy: boolean;
  onOpen: (item: HomeworkView) => void;
  onToggle: (item: HomeworkView) => void;
}) {
  const { t } = useTranslation();
  return (
    <article
      className={styles.task}
      style={subjectStyle(item.color)}
      data-done={item.done || undefined}
      data-selected={selected || undefined}
    >
      <header className={styles.taskHead}>
        <span aria-hidden="true">{item.emoji}</span>
        <button
          type="button"
          className={styles.taskOpen}
          aria-pressed={selected}
          onClick={() => onOpen(item)}
        >
          {item.label}
        </button>
        {item.done ? (
          <TaskCheck item={item} busy={busy} onToggle={onToggle} />
        ) : (
          <span className={styles.taskDue}>{due}</span>
        )}
      </header>
      <p className={styles.taskText}>{item.content}</p>
      {!item.done && (
        <footer className={styles.taskFoot}>
          <button
            type="button"
            className={styles.taskDone}
            aria-label={t("taches.markDone")}
            aria-pressed={false}
            disabled={busy}
            onClick={() => onToggle(item)}
          >
            <Check size={16} aria-hidden="true" />
          </button>
        </footer>
      )}
    </article>
  );
}
