// Mini-calendrier d'un mois (maquette 03-cours/03-jour) : le jour choisi plein, les autres
// jours de sa semaine en clair, le week-end grisé. Un clic choisit un jour. Le parent lui donne
// une `key` par mois pour qu'il suive le jour choisi d'un mois à l'autre.
import { ChevronLeft, ChevronRight } from "@getpapillon/papicons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/Card/Card";
import { addDays, sameDay, weekStart } from "@/lib/week";

import styles from "./MiniCalendar.module.scss";

export function MiniCalendar({
  value,
  highlighted,
  onSelect,
}: {
  /** Le jour choisi. */
  value: Date;
  /** Les jours mis en clair autour de lui (la semaine affichée). */
  highlighted: readonly Date[];
  onSelect: (day: Date) => void;
}) {
  const { t, i18n } = useTranslation();
  // Le mois du jour choisi au montage : le parent change la `key` quand ce mois change.
  const [month, setMonth] = useState(
    () => new Date(value.getFullYear(), value.getMonth(), 1)
  );

  const first = weekStart(month);
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i));
  const weeks = Array.from({ length: 6 }, (_, w) =>
    days.slice(w * 7, w * 7 + 7)
  )
    // Pas de ligne qui n'a aucun jour du mois.
    .filter(week => week.some(day => day.getMonth() === month.getMonth()));
  const narrow = new Intl.DateTimeFormat(i18n.language, { weekday: "narrow" });
  const title = new Intl.DateTimeFormat(i18n.language, {
    month: "long",
    year: "numeric",
  });
  const full = new Intl.DateTimeFormat(i18n.language, { dateStyle: "full" });
  const shift = (step: number) =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + step, 1));

  return (
    <Card className={styles.calendar}>
      <header className={styles.head}>
        <h3 className={styles.title} aria-live="polite">
          {title.format(month)}
        </h3>
        <button
          type="button"
          className={styles.arrow}
          aria-label={t("miniCalendar.previous")}
          onClick={() => shift(-1)}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          className={styles.arrow}
          aria-label={t("miniCalendar.next")}
          onClick={() => shift(1)}
        >
          <ChevronRight size={16} />
        </button>
      </header>
      <table className={styles.grid}>
        <thead>
          <tr>
            {days.slice(0, 7).map(day => (
              <th key={day.getDay()} scope="col">
                {narrow.format(day)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map(week => (
            <tr key={week[0]?.getTime()}>
              {week.map(day =>
                day.getMonth() === month.getMonth() ? (
                  <td key={day.getTime()}>
                    <button
                      type="button"
                      className={styles.day}
                      data-selected={sameDay(day, value) || undefined}
                      data-highlighted={
                        highlighted.some(other => sameDay(other, day)) ||
                        undefined
                      }
                      data-weekend={day.getDay() % 6 === 0 || undefined}
                      aria-label={full.format(day)}
                      aria-pressed={sameDay(day, value)}
                      onClick={() => onSelect(day)}
                    >
                      {day.getDate()}
                    </button>
                  </td>
                ) : (
                  <td key={day.getTime()} />
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
