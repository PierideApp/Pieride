// Liste (maquette 04-taches/03-liste, `task_list`) : les devoirs groupés par jour de rendu, une
// ligne chacun avec sa case, sa matière et son échéance. Toute la ligne ouvre le détail.
import { useTranslation } from "react-i18next";

import { capitalize, useDateFormats } from "@/hooks/useFormats";
import type { HomeworkView } from "@/hooks/useHomework";
import { subjectStyle } from "@/lib/subjects";
import { addDays, sameDay, startOfDay } from "@/lib/week";

import styles from "./taches.module.scss";
import { TaskCheck } from "./TaskCheck";

export function TaskList({
  items,
  now,
  selected,
  pending,
  onOpen,
  onToggle,
}: {
  items: readonly HomeworkView[];
  now: Date;
  selected: string | null;
  pending: string | null;
  onOpen: (item: HomeworkView) => void;
  onToggle: (item: HomeworkView) => void;
}) {
  const { t } = useTranslation();
  const formats = useDateFormats();
  // Du dernier jour de rendu au premier, comme la maquette.
  const days = [...new Set(items.map(item => startOfDay(item.dueAt).getTime()))]
    .sort((a, b) => b - a)
    .map(time => new Date(time));

  return (
    <div className={styles.list}>
      {days.map(day => {
        const dayItems = items.filter(item => sameDay(item.dueAt, day));
        const near =
          sameDay(day, now) ||
          sameDay(day, addDays(now, 1)) ||
          sameDay(day, addDays(now, -1));
        const id = `taches-liste-${day.getTime()}`;
        return (
          <section key={day.getTime()} aria-labelledby={id}>
            <h3 id={id} className={styles.listHeading}>
              <span>
                {capitalize(formats.weekday.format(day), formats.locale)}{" "}
                {day.getDate()}
                {near && ` · ${formats.relativeDay(day, now)}`}
              </span>
              <span>{dayItems.length}</span>
            </h3>
            <ul className={styles.rows}>
              {dayItems.map(item => (
                <li
                  key={`${item.serviceId}:${item.id}`}
                  className={styles.row}
                  style={subjectStyle(item.color)}
                  data-done={item.done || undefined}
                  data-selected={selected === item.id || undefined}
                >
                  <TaskCheck
                    item={item}
                    busy={pending === item.id}
                    onToggle={onToggle}
                  />
                  <span className={styles.rowMain}>
                    <button
                      type="button"
                      className={styles.rowOpen}
                      aria-pressed={selected === item.id}
                      onClick={() => onOpen(item)}
                    >
                      {item.content}
                    </button>
                    <span className={styles.rowSubject}>
                      <span aria-hidden="true">{item.emoji}</span> {item.label}
                    </span>
                  </span>
                  <span className={styles.rowDue}>
                    {capitalize(
                      formats.relativeDay(item.dueAt, now),
                      formats.locale
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {items.length === 0 && (
        <p className={styles.listEmpty}>{t("taches.noMatch")}</p>
      )}
    </div>
  );
}
