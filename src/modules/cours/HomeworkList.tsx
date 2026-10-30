// Les devoirs d'un jour ou d'un cours, en lecture (maquettes : « À faire pour demain », « À faire
// pour ce cours ») : case de la couleur de la matière, consigne, puis la matière ou l'échéance.
// Les cocher se fera dans Tâches, qui l'envoie aussi au service.
import { Check } from "@getpapillon/papicons";
import { useTranslation } from "react-i18next";

import type { HomeworkView } from "@/hooks/useHomework";
import { subjectStyle } from "@/lib/subjects";

import styles from "./cours.module.scss";

export function HomeworkList({
  items,
  empty,
  caption,
}: {
  items: readonly HomeworkView[];
  /** Phrase affichée quand il n'y a rien à faire. */
  empty: string;
  /** Sous la consigne, à la place du nom de la matière (« Pour demain »). */
  caption?: string;
}) {
  const { t } = useTranslation();
  if (items.length === 0) {
    return <p className={styles.homeworkEmpty}>{empty}</p>;
  }
  return (
    <ul className={styles.homework}>
      {items.map(item => (
        <li
          key={item.id}
          className={styles.homeworkItem}
          style={subjectStyle(item.color)}
        >
          <span
            className={styles.homeworkCheck}
            data-done={item.done || undefined}
            role="img"
            aria-label={t(item.done ? "cours.done" : "cours.todo")}
          >
            {item.done && <Check size={12} aria-hidden="true" />}
          </span>
          <span>
            <p className={styles.homeworkText}>{item.content}</p>
            <span className={styles.homeworkCaption}>
              {caption ?? item.label}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
