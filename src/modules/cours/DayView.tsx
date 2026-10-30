// Vue jour (maquette 03-cours/03-jour) : les cours dans l'ordre avec leurs horaires et les
// pauses, puis à droite le mini-calendrier et ce qu'il y a à faire pour le jour d'école suivant.
import { Clock, Cutlery, Tasks } from "@getpapillon/papicons";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/Card/Card";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import { MiniCalendar } from "@/components/MiniCalendar/MiniCalendar";
import {
  capitalize,
  useDateFormats,
  useFormatDuration,
} from "@/hooks/useFormats";
import { useHomework } from "@/hooks/useHomework";
import type { CourseView } from "@/hooks/useTimetable";
import { withBreaks } from "@/lib/timetable";
import { addDays, sameDay, shiftDay, weekDays } from "@/lib/week";
import type { ModuleManifest } from "@/modules/registry";
import { useSettingsStore } from "@/stores/settings";

import styles from "./cours.module.scss";
import { CourseCard } from "./CourseCard";
import { HomeworkList } from "./HomeworkList";

const minutesBetween = (from: Date, to: Date) =>
  Math.round((to.getTime() - from.getTime()) / 60_000);

/** Une pause plus courte est une récréation. */
const RECESS = 20;

export function DayView({
  accountId,
  day,
  courses,
  now,
  selected,
  icon,
  onOpen,
  onPickDay,
}: {
  accountId: string | undefined;
  day: Date;
  courses: readonly CourseView[];
  now: Date;
  selected: string | null;
  icon: ModuleManifest["icon"];
  onOpen: (course: CourseView) => void;
  onPickDay: (day: Date) => void;
}) {
  const { t } = useTranslation();
  const showBreaks = useSettingsStore(state => state.showBreaks);
  const weekend = useSettingsStore(state => state.showWeekend);
  const formats = useDateFormats();
  const duration = useFormatDuration();
  const next = shiftDay(day, 1, weekend);
  const homework = useHomework(accountId, next);

  const list = courses.filter(course => sameDay(course.from, day));
  const held = list.filter(course => course.status !== "canceled");
  const canceled = list.length - held.length;
  const end = held[held.length - 1]?.to;
  const entries = showBreaks
    ? withBreaks(list)
    : list.map(item => ({ kind: "course" as const, item }));

  const heading = sameDay(day, now)
    ? t("cours.today")
    : sameDay(day, addDays(now, 1))
      ? t("cours.tomorrow")
      : capitalize(formats.longDate.format(day), formats.locale);

  return (
    <div className={styles.dayLayout}>
      <section className={styles.dayMain} aria-labelledby="cours-day">
        <h2 id="cours-day" className={styles.dayHeading}>
          {heading}
        </h2>
        {list.length > 0 && (
          <p className={styles.daySummary}>
            {[
              t("cours.count", { count: list.length }),
              canceled > 0 && t("cours.canceledCount", { count: canceled }),
            ]
              .filter(Boolean)
              .join(", ")}
            {end &&
              ` · ${t("cours.endsAt", { time: formats.time.format(end) })}`}
          </p>
        )}
        {list.length === 0 ? (
          <Card className={styles.dayEmpty}>
            <EmptyState
              icon={icon}
              title={t("cours.emptyDay.title")}
              text={t("cours.emptyDay.text")}
            />
          </Card>
        ) : (
          <ol className={styles.dayList}>
            {entries.map(entry => {
              if (entry.kind === "break") {
                const minutes = minutesBetween(entry.from, entry.to);
                const Icon = entry.lunch ? Cutlery : Clock;
                return (
                  <li
                    key={`pause-${entry.from.getTime()}`}
                    className={styles.break}
                  >
                    <Icon size={16} aria-hidden="true" />
                    <span>
                      {t(
                        entry.lunch
                          ? "cours.lunch"
                          : minutes <= RECESS
                            ? "cours.recess"
                            : "cours.break"
                      )}
                    </span>
                    <span className={styles.breakDuration}>
                      {duration(minutes)}
                    </span>
                  </li>
                );
              }
              const course = entry.item;
              const ongoing =
                course.status !== "canceled" &&
                now >= course.from &&
                now < course.to;
              return (
                <li
                  key={course.id}
                  className={styles.dayItem}
                  data-long={
                    minutesBetween(course.from, course.to) > 60 || undefined
                  }
                >
                  <span className={styles.dayTime}>
                    <strong>{formats.time.format(course.from)}</strong>
                    <span>{formats.time.format(course.to)}</span>
                  </span>
                  <CourseCard
                    course={course}
                    variant="full"
                    selected={selected === course.id}
                    onOpen={onOpen}
                    badge={
                      ongoing && (
                        <span className={styles.ongoingBadge}>
                          {t("cours.now")} ·{" "}
                          {t("cours.remaining", {
                            duration: duration(
                              Math.ceil(minutesBetween(now, course.to))
                            ),
                          })}
                        </span>
                      )
                    }
                  >
                    <span className={styles.courseExtra}>
                      {duration(minutesBetween(course.from, course.to))}
                    </span>
                  </CourseCard>
                </li>
              );
            })}
          </ol>
        )}
      </section>
      <aside className={styles.daySide}>
        <MiniCalendar
          key={`${day.getFullYear()}-${day.getMonth()}`}
          value={day}
          highlighted={weekDays(day, weekend)}
          onSelect={onPickDay}
        />
        <Card className={styles.sideCard}>
          <h3 className={styles.sideTitle}>
            <Tasks size={18} aria-hidden="true" />
            {sameDay(next, addDays(now, 1))
              ? t("cours.homeworkTomorrow")
              : t("cours.homeworkFor", {
                  day: formats.longDate.format(next),
                })}
          </h3>
          {homework.status === "error" ? (
            <p className={styles.homeworkEmpty} role="alert">
              {t("errors.database")}
            </p>
          ) : (
            <HomeworkList
              items={
                homework.status === "ready"
                  ? homework.data.filter(item => sameDay(item.dueAt, next))
                  : []
              }
              empty={t("cours.noHomework")}
            />
          )}
        </Card>
      </aside>
    </div>
  );
}
