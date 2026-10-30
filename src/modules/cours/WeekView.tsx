// Vue semaine (maquette 03-cours/01-semaine, `week_grid`) : une colonne par jour, les cours à
// leur heure, côte à côte quand ils se chevauchent, la pause de midi et l'heure actuelle. La
// grille occupe toute la hauteur ; les positions sont en minutes depuis sa première heure.
import { Cutlery, Sun } from "@getpapillon/papicons";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/Card/Card";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import { useDateFormats } from "@/hooks/useFormats";
import type { CourseView } from "@/hooks/useTimetable";
import { hourRange, minutesOf, placeDay, withBreaks } from "@/lib/timetable";
import { sameDay } from "@/lib/week";
import { useSettingsStore } from "@/stores/settings";

import styles from "./cours.module.scss";
import { CourseCard } from "./CourseCard";

export function WeekView({
  days,
  courses,
  now,
  selected,
  onOpen,
  onPickDay,
}: {
  days: readonly Date[];
  courses: readonly CourseView[];
  now: Date;
  /** Le cours dont le détail est ouvert. */
  selected: string | null;
  onOpen: (course: CourseView) => void;
  /** Clic sur l'en-tête d'un jour : sa vue jour. */
  onPickDay: (day: Date) => void;
}) {
  const { t } = useTranslation();
  const showNowLine = useSettingsStore(state => state.showNowLine);
  const showBreaks = useSettingsStore(state => state.showBreaks);
  const formats = useDateFormats();
  const shown = courses.filter(course =>
    days.some(day => sameDay(course.from, day))
  );
  const range = hourRange(shown);
  const hours = range.last - range.first;
  const top = (minutes: number) => minutes - range.first * 60;
  const nowTop = top(minutesOf(now));
  const nowShown =
    showNowLine &&
    nowTop >= 0 &&
    nowTop <= hours * 60 &&
    days.some(day => sameDay(day, now));

  return (
    <div className={styles.week} style={{ "--hours": hours }}>
      <div className={styles.weekHead}>
        {days.map(day => (
          <button
            key={day.getTime()}
            type="button"
            className={styles.weekDay}
            data-today={sameDay(day, now) || undefined}
            aria-label={formats.longDate.format(day)}
            onClick={() => onPickDay(day)}
          >
            <span>{formats.shortWeekday.format(day)}</span>
            <strong>{day.getDate()}</strong>
          </button>
        ))}
      </div>
      <div className={styles.weekBody}>
        <div className={styles.hours} aria-hidden="true">
          {Array.from({ length: hours + 1 }, (_, index) => (
            <div
              key={index}
              className={styles.hour}
              style={{ "--from": index * 60 }}
            >
              <span>
                {formats.time.format(new Date(2000, 0, 1, range.first + index))}
              </span>
            </div>
          ))}
          {nowShown && (
            <span className={styles.nowLabel} style={{ "--from": nowTop }}>
              {formats.time.format(now)}
            </span>
          )}
        </div>
        {days.map(day => {
          const dayCourses = shown.filter(course => sameDay(course.from, day));
          return (
            <ol
              key={day.getTime()}
              className={styles.dayColumn}
              aria-label={formats.longDate.format(day)}
            >
              {showBreaks &&
                withBreaks(dayCourses).map(
                  entry =>
                    entry.kind === "break" &&
                    entry.lunch && (
                      <li
                        key={`midi-${entry.from.getTime()}`}
                        className={styles.lunchBand}
                        style={{
                          "--from": top(minutesOf(entry.from)),
                          "--to": top(minutesOf(entry.to)),
                        }}
                      >
                        <Cutlery size={16} aria-hidden="true" />
                        <span className={styles.visuallyHidden}>
                          {t("cours.lunch")}
                        </span>
                      </li>
                    )
                )}
              {placeDay(dayCourses).map(placed => (
                <li
                  key={placed.item.id}
                  className={styles.slot}
                  style={{
                    "--from": top(placed.start),
                    "--to": top(placed.end),
                    "--column": placed.column,
                    "--columns": placed.columns,
                  }}
                >
                  <CourseCard
                    course={placed.item}
                    variant="compact"
                    selected={selected === placed.item.id}
                    onOpen={onOpen}
                  >
                    <span className={styles.visuallyHidden}>
                      {t("cours.time", {
                        from: formats.time.format(placed.item.from),
                        to: formats.time.format(placed.item.to),
                      })}
                    </span>
                  </CourseCard>
                </li>
              ))}
              {nowShown && sameDay(day, now) && (
                <li
                  className={styles.nowLine}
                  style={{ "--from": nowTop }}
                  aria-hidden="true"
                />
              )}
            </ol>
          );
        })}
        {shown.length === 0 && (
          <div className={styles.weekEmpty}>
            <Card className={styles.weekEmptyCard}>
              <EmptyState
                icon={Sun}
                title={t("cours.empty.title")}
                text={t("cours.empty.text")}
              />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
