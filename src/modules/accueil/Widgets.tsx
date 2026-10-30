// Les widgets de l'accueil (maquette 02-accueil). Chacun montre plus ou moins selon sa taille
// (`level`) : réduit, l'essentiel ; normal, la maquette ; large, le plus d'informations. Chacun
// mène à son module.
import {
  ArrowRightDown,
  ArrowRightUp,
  Calendar,
  Cutlery,
  Grades,
  Newspaper,
  Pie,
  Sunrise,
  Tasks,
  UserCross,
} from "@getpapillon/papicons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { Avatar } from "@/components/Avatar/Avatar";
import { Card } from "@/components/Card/Card";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import { LineChart } from "@/components/LineChart/LineChart";
import { SubjectEmoji } from "@/components/SubjectEmoji/SubjectEmoji";
import type { AttendanceView } from "@/hooks/useAttendance";
import {
  capitalize,
  hoursMinutes,
  useDateFormats,
  useFormatDuration,
} from "@/hooks/useFormats";
import type { GradeView, PeriodView } from "@/hooks/useGrades";
import type { HomeworkView } from "@/hooks/useHomework";
import type { NewsView } from "@/hooks/useNews";
import { useScore } from "@/hooks/useScore";
import type { CourseView } from "@/hooks/useTimetable";
import { average, history, subjectAverages } from "@/lib/grades";
import { subjectStyle } from "@/lib/subjects";
import { withBreaks } from "@/lib/timetable";
import { sameDay, startOfDay } from "@/lib/week";
import { CourseCard } from "@/modules/cours/CourseCard";
import { TaskCheck } from "@/modules/taches/TaskCheck";
import { useSettingsStore } from "@/stores/settings";

import styles from "./accueil.module.scss";
import type { WidgetLevel } from "./layout";

const minutesBetween = (from: Date, to: Date) =>
  Math.round((to.getTime() - from.getTime()) / 60_000);

function WidgetHead({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Calendar;
  title: string;
  /** À droite : lien vers le module, compteur… */
  children?: ReactNode;
}) {
  return (
    <header className={styles.widgetHead}>
      <Icon size={18} aria-hidden="true" />
      <h2>{title}</h2>
      {children}
    </header>
  );
}

/** Rien à montrer : l'état vide de l'app, comme dans le module, plus serré en petit. */
function WidgetEmpty({
  icon,
  title,
  text,
  small = false,
}: {
  icon: typeof Calendar;
  title: string;
  text: string;
  small?: boolean;
}) {
  return (
    <div className={styles.widgetEmpty}>
      <EmptyState
        icon={icon}
        title={title}
        text={text}
        size={small ? "small" : "medium"}
      />
    </div>
  );
}

function WidgetLink({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className={styles.widgetLink}
      onClick={() => void navigate(to)}
    >
      {label}
      <ArrowRightUp size={14} aria-hidden="true" />
    </button>
  );
}

function FootLink({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className={styles.footLink}
      onClick={() => void navigate(to)}
    >
      {label}
    </button>
  );
}

/** Un widget en carte d'une ligne : le raccourci de la maquette (`QUICK`). */
function Shortcut({
  to,
  icon: Icon,
  tone,
  title,
  text,
}: {
  to: string;
  icon: typeof Calendar;
  tone: "accent" | "success" | "warning" | "info" | "sulfur";
  title: string;
  text: string;
}) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className={styles.shortcut}
      data-tone={tone}
      onClick={() => void navigate(to)}
    >
      <span aria-hidden="true">
        <Icon size={20} />
      </span>
      <strong>{title}</strong>
      <small>{text}</small>
    </button>
  );
}

// ---------- Cours ----------

function CourseList({
  courses,
  now,
  compactBreaks = false,
}: {
  courses: readonly CourseView[];
  now: Date;
  /** Sans les pauses (liste étroite). */
  compactBreaks?: boolean;
}) {
  const { t } = useTranslation();
  const formats = useDateFormats();
  const duration = useFormatDuration();
  const showBreaks = useSettingsStore(state => state.showBreaks);
  const navigate = useNavigate();
  const entries =
    showBreaks && !compactBreaks
      ? withBreaks(courses)
      : courses.map(item => ({ kind: "course" as const, item }));
  return (
    <ol className={styles.courses}>
      {entries.map(entry => {
        if (entry.kind === "break") {
          return entry.lunch ? (
            <li key={`midi-${entry.from.getTime()}`} className={styles.lunch}>
              <Cutlery size={16} aria-hidden="true" />
              {t("cours.lunch")}
              <span>{duration(minutesBetween(entry.from, entry.to))}</span>
            </li>
          ) : null;
        }
        const course = entry.item;
        const ongoing =
          course.status !== "canceled" && now >= course.from && now < course.to;
        return (
          <li key={course.id} className={styles.courseItem}>
            <span className={styles.courseTime}>
              <strong>{formats.time.format(course.from)}</strong>
              <span>{formats.time.format(course.to)}</span>
            </span>
            <CourseCard
              course={course}
              variant="full"
              selected={false}
              onOpen={() => void navigate("/cours")}
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
              <span className={styles.courseDuration}>
                {duration(minutesBetween(course.from, course.to))}
              </span>
              {ongoing && (
                <span
                  className={styles.courseProgress}
                  style={{
                    "--progress":
                      minutesBetween(course.from, now) /
                      minutesBetween(course.from, course.to),
                  }}
                />
              )}
            </CourseCard>
          </li>
        );
      })}
    </ol>
  );
}

export function CoursesWidget({
  level,
  remaining,
  nextDay,
  nextCourses,
  now,
}: {
  level: WidgetLevel;
  /** Les cours d'aujourd'hui qui ne sont pas finis. */
  remaining: readonly CourseView[];
  /** Le prochain jour d'école et ses cours. */
  nextDay: Date;
  nextCourses: readonly CourseView[];
  now: Date;
}) {
  const { t } = useTranslation();
  const formats = useDateFormats();
  const held = remaining.filter(course => course.status !== "canceled");
  // Journée finie (ou sans cours) : on montre le prochain jour d'école.
  const dayOver = held.length === 0;
  const nextName = formats.relativeDay(nextDay, now);
  const first = nextCourses.find(course => course.status !== "canceled");

  if (level === "mini") {
    const current = held[0];
    return (
      <Shortcut
        to="/cours"
        icon={Calendar}
        tone="accent"
        title={t("modules.cours")}
        text={
          current
            ? t("accueil.mini.course", {
                subject: current.label,
                time: formats.time.format(current.from),
              })
            : first
              ? t("accueil.mini.nextCourse", {
                  day: capitalize(nextName, formats.locale),
                  subject: first.label,
                  time: formats.time.format(first.from),
                })
              : t("accueil.noMoreCourses")
        }
      />
    );
  }

  // Comme la page Cours : « Aucun cours ce jour-là » ; aujourd'hui fini, la fin de journée.
  const empty = (day: Date | null) => (
    <WidgetEmpty
      icon={Calendar}
      title={day ? t("cours.emptyDay.title") : t("accueil.noMoreCourses")}
      text={day ? t("cours.emptyDay.text") : t("accueil.dayOverText")}
      small={level === "compact"}
    />
  );

  if (level === "large") {
    return (
      <Card className={styles.widget}>
        <WidgetHead icon={Calendar} title={t("accueil.widgets.courses")}>
          <WidgetLink to="/cours" label={t("accueil.more")} />
        </WidgetHead>
        <div className={styles.columns}>
          <section>
            <h3 className={styles.columnTitle}>{t("cours.today")}</h3>
            {remaining.length > 0 ? (
              <CourseList courses={remaining} now={now} />
            ) : (
              empty(null)
            )}
          </section>
          <section>
            <h3 className={styles.columnTitle}>
              {capitalize(nextName, formats.locale)}
            </h3>
            {nextCourses.length > 0 ? (
              <CourseList courses={nextCourses} now={now} />
            ) : (
              empty(nextDay)
            )}
          </section>
        </div>
      </Card>
    );
  }

  const day = dayOver ? nextDay : now;
  const list = dayOver ? nextCourses : remaining;
  const title = dayOver
    ? capitalize(nextName, formats.locale)
    : t("cours.today");

  if (level === "compact") {
    const [current, then] = list.filter(course => course.status !== "canceled");
    return (
      <Card className={styles.widget}>
        <WidgetHead icon={Calendar} title={title} />
        {current ? (
          <>
            <CourseList courses={[current]} now={now} compactBreaks />
            {then && (
              <p className={styles.then}>
                {t("accueil.then", {
                  subject: then.label,
                  time: formats.time.format(then.from),
                })}
              </p>
            )}
          </>
        ) : (
          empty(dayOver ? day : null)
        )}
      </Card>
    );
  }

  return (
    <Card className={styles.widget}>
      <WidgetHead icon={Calendar} title={title}>
        <WidgetLink to="/cours" label={t("accueil.more")} />
      </WidgetHead>
      <div className={styles.scroll}>
        {list.length > 0 ? (
          <CourseList courses={list} now={now} />
        ) : (
          empty(dayOver ? day : null)
        )}
      </div>
      {!dayOver && first && (
        <p className={styles.nextCourse}>
          <Sunrise size={16} aria-hidden="true" />
          {t(first.room ? "accueil.nextCourseRoom" : "accueil.nextCourse", {
            day: capitalize(nextName, formats.locale),
            time: formats.time.format(first.from),
            subject: first.label,
            room: first.room,
          })}
        </p>
      )}
    </Card>
  );
}

// ---------- Moyenne ----------

export function AverageWidget({
  level,
  grades,
  period,
}: {
  level: WidgetLevel;
  grades: readonly GradeView[];
  period: PeriodView | undefined;
}) {
  const { t } = useTranslation();
  const method = useSettingsStore(state => state.averageMethod);
  const formats = useDateFormats();
  const score = useScore();
  const value = average(grades, method);
  const points = history(grades, method);
  const monthStart = startOfDay(new Date());
  monthStart.setDate(1);
  const before = points.filter(point => point.date < monthStart).pop();
  const delta =
    value !== undefined && before ? value - before.value : undefined;

  if (level === "mini") {
    return (
      <Shortcut
        to="/notes"
        icon={Pie}
        tone="accent"
        title={t("accueil.average")}
        text={
          value === undefined
            ? t("notes.empty.title")
            : `${score.format(value)}/${score.scale}${
                delta === undefined ? "" : ` · ${score.delta(delta)}`
              }`
        }
      />
    );
  }

  const dayMonth = new Intl.DateTimeFormat(formats.locale, {
    day: "numeric",
    month: "long",
  });
  const figure = (
    <div>
      <p className={styles.averageValue}>
        {value === undefined ? "-" : score.format(value)}
        <small>/{score.scale}</small>
      </p>
      {delta !== undefined && (
        <span className={styles.delta} data-down={delta < 0 || undefined}>
          {delta < 0 ? (
            <ArrowRightDown size={12} aria-hidden="true" />
          ) : (
            <ArrowRightUp size={12} aria-hidden="true" />
          )}
          {t("notes.since", {
            delta: score.delta(delta),
            date: t("notes.monthStart", {
              month: new Intl.DateTimeFormat(formats.locale, {
                month: "long",
              }).format(monthStart),
            }),
          })}
        </span>
      )}
    </div>
  );
  const chart = (
    <div className={styles.averageChart}>
      <LineChart
        points={points}
        label={t("notes.evolution")}
        formatDate={date => dayMonth.format(date)}
        formatValue={score.format}
      />
    </div>
  );
  // Moyenne de chaque matière, de la meilleure à la plus basse (taille large).
  const subjects =
    level === "large"
      ? [...subjectAverages(grades)]
          .map(([subject, subjectAverage]) => ({
            grade: grades.find(grade => grade.subject === subject),
            average: subjectAverage,
          }))
          .sort((a, b) => b.average - a.average)
      : [];

  return (
    <Card className={styles.widget}>
      <WidgetHead icon={Pie} title={t("accueil.average")}>
        {level !== "compact" && (
          <WidgetLink to="/notes" label={t("modules.notes")} />
        )}
      </WidgetHead>
      {value === undefined ? (
        <WidgetEmpty
          icon={Pie}
          title={t("notes.empty.title")}
          text={t("notes.empty.text")}
          small={level !== "large"}
        />
      ) : level === "large" ? (
        <>
          <div className={styles.averageTop}>
            {figure}
            {chart}
          </div>
          <ul className={styles.subjectAverages}>
            {subjects.map(
              ({ grade, average: subjectAverage }) =>
                grade && (
                  <li key={grade.subject} style={subjectStyle(grade.color)}>
                    <SubjectEmoji emoji={grade.emoji} color={grade.color} />
                    <span>{grade.label}</span>
                    <b>{score.format(subjectAverage)}</b>
                  </li>
                )
            )}
          </ul>
        </>
      ) : (
        <div className={styles.averageBody}>
          {figure}
          {level === "normal" && chart}
        </div>
      )}
      <small className={styles.averageFoot}>
        {t(`notes.methods.${method}.title`)}
        {period && ` · ${period.name}`}
      </small>
    </Card>
  );
}

// ---------- Tâches ----------

export function TasksWidget({
  level,
  items,
  now,
  pending,
  onToggle,
}: {
  level: WidgetLevel;
  /** Les devoirs à rendre à partir d'aujourd'hui, dans l'ordre. */
  items: readonly HomeworkView[];
  now: Date;
  pending: string | null;
  onToggle: (item: HomeworkView) => void;
}) {
  const { t } = useTranslation();
  const formats = useDateFormats();
  const left = items.filter(item => !item.done);

  if (level === "mini") {
    const next = left[0];
    return (
      <Shortcut
        to="/taches"
        icon={Tasks}
        tone="success"
        title={t("modules.taches")}
        text={
          next
            ? `${t("accueil.left", { count: left.length })} · ${t(
                "taches.dueFor",
                { day: formats.relativeDay(next.dueAt, now) }
              )}`
            : t("accueil.noTasks")
        }
      />
    );
  }

  const row = (item: HomeworkView, withDay: boolean) => (
    <li
      key={`${item.serviceId}:${item.id}`}
      style={subjectStyle(item.color)}
      data-done={item.done || undefined}
    >
      <TaskCheck item={item} busy={pending === item.id} onToggle={onToggle} />
      <span>
        <p>{item.content}</p>
        <small>
          <span aria-hidden="true">{item.emoji}</span> {item.label}
          {withDay &&
            ` · ${t("taches.dueFor", { day: formats.relativeDay(item.dueAt, now) })}`}
        </small>
      </span>
    </li>
  );
  const head = (
    <WidgetHead icon={Tasks} title={t("accueil.tasks")}>
      {level !== "compact" && left.length > 0 && (
        <span className={styles.countChip}>
          {t("accueil.left", { count: left.length })}
        </span>
      )}
    </WidgetHead>
  );

  if (level === "compact") {
    const next = left[0];
    return (
      <Card className={styles.widget}>
        {head}
        <p className={styles.bigCount}>
          {left.length}
          <small>{t("taches.left", { count: left.length })}</small>
        </p>
        {next && (
          <p className={styles.then}>
            {next.label} ·{" "}
            {t("taches.dueFor", { day: formats.relativeDay(next.dueAt, now) })}
          </p>
        )}
      </Card>
    );
  }

  // Large : toutes les tâches à venir, groupées par jour de rendu.
  const days =
    level === "large"
      ? [...new Set(items.map(item => startOfDay(item.dueAt).getTime()))].map(
          time => new Date(time)
        )
      : [];

  return (
    <Card className={styles.widget}>
      {head}
      {items.length === 0 ? (
        <WidgetEmpty
          icon={Tasks}
          title={t("taches.none")}
          text={t("taches.empty.text")}
        />
      ) : level === "large" ? (
        <div className={`${styles.scroll} ${styles.groups}`}>
          {days.map(day => (
            <section key={day.getTime()}>
              <h3 className={styles.columnTitle}>
                {capitalize(formats.relativeDay(day, now), formats.locale)}
              </h3>
              <ul className={styles.tasks}>
                {items
                  .filter(item => sameDay(item.dueAt, day))
                  .map(item => row(item, false))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <ul className={styles.tasks}>
          {items.slice(0, 4).map(item => row(item, true))}
        </ul>
      )}
      <FootLink to="/taches" label={t("accueil.allTasks")} />
    </Card>
  );
}

// ---------- Nouvelles notes ----------

export function GradesWidget({
  level,
  grades,
  now,
}: {
  level: WidgetLevel;
  grades: readonly GradeView[];
  now: Date;
}) {
  const { t } = useTranslation();
  const formats = useDateFormats();
  const score = useScore();
  const sorted = [...grades].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );

  if (level === "mini") {
    const last = sorted[0];
    return (
      <Shortcut
        to="/notes"
        icon={Grades}
        tone="sulfur"
        title={t("notes.latest")}
        text={
          last
            ? t("accueil.mini.grade", {
                value: score.grade(last),
                subject: last.label,
              })
            : t("notes.empty.title")
        }
      />
    );
  }

  const latest = sorted.slice(0, { compact: 2, normal: 4, large: 8 }[level]);
  const when = (date: Date) =>
    capitalize(
      now.getTime() - date.getTime() < 6 * 86_400_000
        ? formats.relativeDay(date, now)
        : formats.shortDate.format(date),
      formats.locale
    );
  return (
    <Card className={styles.widget}>
      <WidgetHead icon={Grades} title={t("notes.latest")} />
      {latest.length === 0 ? (
        <WidgetEmpty
          icon={Grades}
          title={t("notes.empty.title")}
          text={t("notes.empty.text")}
          small={level === "compact"}
        />
      ) : (
        <ul className={styles.grades} data-level={level}>
          {latest.map(grade => (
            <li key={`${grade.serviceId}:${grade.id}`}>
              <SubjectEmoji emoji={grade.emoji} color={grade.color} size={30} />
              <span>
                <strong>{grade.title || grade.label}</strong>
                <small>
                  {grade.label} · {when(grade.date)}
                  {level === "large" &&
                    grade.classAverage !== undefined &&
                    ` · ${t("accueil.classAverage", {
                      value: score.format(
                        (grade.classAverage / grade.outOf) * 20
                      ),
                    })}`}
                </small>
              </span>
              <b>{score.grade(grade)}</b>
              <small>/{score.scale}</small>
            </li>
          ))}
        </ul>
      )}
      {level !== "compact" && (
        <FootLink to="/notes" label={t("accueil.allGrades")} />
      )}
    </Card>
  );
}

// ---------- Assiduité ----------

export function AttendanceWidget({
  level,
  items,
  now,
}: {
  level: WidgetLevel;
  /** Absences et retards de la période en cours, du plus récent au plus ancien. */
  items: readonly AttendanceView[];
  now: Date;
}) {
  const { t } = useTranslation();
  const formats = useDateFormats();
  const absences = items.filter(item => item.kind === "absence");
  const missed = absences.reduce((sum, item) => sum + item.durationMinutes, 0);
  const unjustified = items
    .filter(item => !item.justified)
    .reduce((sum, item) => sum + item.durationMinutes, 0);

  if (level === "mini") {
    return (
      <Shortcut
        to="/assiduite"
        icon={UserCross}
        tone="warning"
        title={t("modules.assiduite")}
        text={
          unjustified > 0
            ? t("accueil.unjustified", { duration: hoursMinutes(unjustified) })
            : t("accueil.allJustified")
        }
      />
    );
  }
  const stats = [
    { label: t("assiduite.stats.missed"), value: hoursMinutes(missed) },
    {
      label: t("assiduite.stats.unjustified"),
      value: hoursMinutes(unjustified),
      alert: unjustified > 0,
    },
    { label: t("assiduite.stats.absences"), value: String(absences.length) },
    {
      label: t("assiduite.stats.delays"),
      value: String(items.length - absences.length),
    },
  ];
  return (
    <Card className={styles.widget}>
      <WidgetHead icon={UserCross} title={t("modules.assiduite")}>
        <WidgetLink to="/assiduite" label={t("accueil.more")} />
      </WidgetHead>
      <ul className={styles.stats} data-level={level}>
        {stats.map(stat => (
          <li key={stat.label}>
            <strong data-alert={stat.alert || undefined}>{stat.value}</strong>
            <small>{stat.label}</small>
          </li>
        ))}
      </ul>
      {level === "large" && items.length === 0 && (
        <WidgetEmpty
          icon={UserCross}
          title={t("assiduite.empty.title")}
          text={t("assiduite.empty.text")}
        />
      )}
      {level === "large" && items.length > 0 && (
        <ul className={styles.absences}>
          {items.slice(0, 4).map(item => (
            <li key={`${item.kind}:${item.id}`}>
              <span>
                <strong>{t(`assiduite.kinds.${item.kind}`)}</strong>
                <small>
                  {capitalize(
                    formats.relativeDay(item.from, now),
                    formats.locale
                  )}{" "}
                  · {item.reason ?? t("assiduite.noReason")}
                </small>
              </span>
              <span
                className={styles.status}
                data-ok={item.justified || undefined}
              >
                {hoursMinutes(item.durationMinutes)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------- Actualités ----------

/** « Mme Leroy » devient un prénom et un nom pour les initiales (« ML »). */
const authorOf = (author: string) => {
  const [firstName = "", ...rest] = author.split(" ");
  return { firstName, lastName: rest.join(" ") };
};

export function NewsWidget({
  level,
  items,
}: {
  level: WidgetLevel;
  /** Les actualités, de la plus récente à la plus ancienne. */
  items: readonly NewsView[];
}) {
  const { t } = useTranslation();
  const formats = useDateFormats();
  const navigate = useNavigate();
  const unread = items.filter(item => !item.read).length;

  if (level === "mini") {
    return (
      <Shortcut
        to="/actualites"
        icon={Newspaper}
        tone="info"
        title={t("modules.actualites")}
        text={
          unread > 0
            ? t("accueil.unread", { count: unread })
            : t("accueil.allRead")
        }
      />
    );
  }
  const [featured, ...others] = items;
  // Normal : deux lignes tiennent dans sa hauteur, avec le lien du bas.
  const list = level === "large" ? others.slice(0, 3) : items.slice(0, 2);
  return (
    <Card className={styles.widget}>
      <WidgetHead icon={Newspaper} title={t("modules.actualites")}>
        {unread > 0 && (
          <span className={styles.countChip}>
            {t("accueil.unread", { count: unread })}
          </span>
        )}
      </WidgetHead>
      {items.length === 0 ? (
        <WidgetEmpty
          icon={Newspaper}
          title={t("actualites.empty.title")}
          text={t("actualites.empty.text")}
          small={level !== "large"}
        />
      ) : (
        <>
          {level === "large" && featured && (
            <button
              type="button"
              className={styles.featured}
              onClick={() => void navigate("/actualites")}
            >
              <small>
                {featured.author} · {formats.shortDate.format(featured.date)}
              </small>
              <strong>{featured.title ?? t("actualites.untitled")}</strong>
              <p>{featured.content}</p>
            </button>
          )}
          <ul className={styles.news}>
            {list.map(item => (
              <li key={`${item.serviceId}:${item.id}`}>
                <button
                  type="button"
                  data-unread={!item.read || undefined}
                  onClick={() => void navigate("/actualites")}
                >
                  <Avatar account={authorOf(item.author)} size={30} />
                  <span>
                    <strong>{item.title ?? t("actualites.untitled")}</strong>
                    <small>
                      {item.author} · {formats.shortDate.format(item.date)}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <FootLink to="/actualites" label={t("accueil.allNews")} />
    </Card>
  );
}
