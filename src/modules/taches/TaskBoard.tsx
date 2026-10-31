// Tableau (maquette 04-taches/01-tableau, `board_columns`) : une colonne par jour, une carte
// par devoir. Les colonnes gardent une largeur lisible et défilent quand le détail est ouvert
// (maquette 03-tableau-detail) : la colonne de la tâche ouverte reste visible, et une flèche
// sur le bord ramène aux jours cachés (`scroll_hint`), les barres de défilement étant cachées.
import { ChevronLeft, ChevronRight, Ghost } from "@getpapillon/papicons";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { capitalize, useDateFormats } from "@/hooks/useFormats";
import type { HomeworkView } from "@/hooks/useHomework";
import { sameDay } from "@/lib/week";

import styles from "./taches.module.scss";
import { TaskCard } from "./TaskCard";

const motion = (): ScrollBehavior =>
  matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

export function TaskBoard({
  days,
  items,
  now,
  selected,
  pending,
  onOpen,
  onToggle,
}: {
  days: readonly Date[];
  items: readonly HomeworkView[];
  now: Date;
  selected: string | null;
  pending: string | null;
  onOpen: (item: HomeworkView) => void;
  onToggle: (item: HomeworkView) => void;
}) {
  const { t } = useTranslation();
  const formats = useDateFormats();
  const board = useRef<HTMLDivElement>(null);
  // Des colonnes dépassent avant ou après la partie visible.
  const [hidden, setHidden] = useState({ before: false, after: false });

  useEffect(() => {
    const element = board.current;
    if (!element) {
      return;
    }
    const update = () => {
      const { scrollLeft, clientWidth, scrollWidth } = element;
      const before = scrollLeft > 1;
      const after = scrollLeft + clientWidth < scrollWidth - 1;
      setHidden(current =>
        current.before === before && current.after === after
          ? current
          : { before, after }
      );
    };
    // L'observateur appelle `update` dès le départ, puis à chaque changement de largeur
    // (détail ouvert ou fermé, fenêtre redimensionnée).
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, [days.length]);

  // La tâche ouverte reste visible quand le détail réduit le tableau.
  useEffect(() => {
    if (selected) {
      board.current?.querySelector("[data-selected]")?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: motion(),
      });
    }
  }, [selected]);

  /** Une largeur visible de plus vers les jours cachés de ce côté. */
  const scroll = (direction: 1 | -1) =>
    board.current?.scrollBy({
      left: direction * board.current.clientWidth,
      behavior: motion(),
    });

  return (
    <div className={styles.boardFrame}>
      <div ref={board} className={styles.board}>
        {days.map(day => {
          const dayItems = items.filter(item => sameDay(item.dueAt, day));
          const today = sameDay(day, now);
          const id = `taches-${day.getTime()}`;
          return (
            <section
              key={day.getTime()}
              className={styles.column}
              data-today={today || undefined}
              aria-labelledby={id}
            >
              <header className={styles.columnHead}>
                <h3 id={id}>
                  {capitalize(formats.weekday.format(day), formats.locale)}{" "}
                  {day.getDate()}
                </h3>
                {today ? (
                  <span className={styles.todayChip}>{t("cours.today")}</span>
                ) : (
                  dayItems.length > 0 && (
                    <span className={styles.countChip}>{dayItems.length}</span>
                  )
                )}
              </header>
              {dayItems.length === 0 ? (
                <p className={styles.columnEmpty}>
                  <Ghost size={24} aria-hidden="true" />
                  {t("taches.none")}
                </p>
              ) : (
                <ul className={styles.cards}>
                  {dayItems.map(item => (
                    <li key={`${item.serviceId}:${item.id}`}>
                      <TaskCard
                        item={item}
                        due={formats.relativeDay(item.dueAt, now)}
                        selected={selected === item.id}
                        busy={pending === item.id}
                        onOpen={onOpen}
                        onToggle={onToggle}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      {hidden.before && (
        <button
          type="button"
          className={styles.scrollHint}
          aria-label={t("taches.previousDays")}
          title={t("taches.previousDays")}
          onClick={() => scroll(-1)}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
      )}
      {hidden.after && (
        <button
          type="button"
          className={styles.scrollHint}
          data-side="after"
          aria-label={t("taches.nextDays")}
          title={t("taches.nextDays")}
          onClick={() => scroll(1)}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
