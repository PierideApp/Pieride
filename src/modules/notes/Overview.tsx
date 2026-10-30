// Haut de l'onglet Matières (maquette 05-notes/01-matieres) : la moyenne générale et sa
// courbe, la méthode de calcul sous le chiffre, les statistiques, puis les nouvelles notes.
import {
  Apple,
  ArrowDown,
  ArrowRightDown,
  ArrowRightUp,
  ArrowUp,
  Grades,
  Star,
} from "@getpapillon/papicons";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/Card/Card";
import { LineChart } from "@/components/LineChart/LineChart";
import { Menu } from "@/components/Menu/Menu";
import { useDateFormats } from "@/hooks/useFormats";
import type { GradeView, PeriodView } from "@/hooks/useGrades";
import { useScore } from "@/hooks/useScore";
import {
  average,
  AVERAGE_METHODS,
  type AverageMethod,
  history,
} from "@/lib/grades";
import { subjectStyle } from "@/lib/subjects";
import { useSettingsStore } from "@/stores/settings";

import styles from "./notes.module.scss";
import type { SubjectSummary } from "./subjects";

export function AverageCard({
  grades,
  period,
}: {
  grades: readonly GradeView[];
  period: PeriodView | undefined;
}) {
  const { t } = useTranslation();
  const method = useSettingsStore(state => state.averageMethod);
  const setPreference = useSettingsStore(state => state.setPreference);
  const formats = useDateFormats();
  const score = useScore();
  const value = average(grades, method);
  const points = history(grades, method);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const before = points.filter(point => point.date < monthStart).pop();
  const delta =
    value !== undefined && before ? value - before.value : undefined;
  const dayMonth = new Intl.DateTimeFormat(formats.locale, {
    day: "numeric",
    month: "long",
  });

  return (
    <Card className={styles.averageCard}>
      <div className={styles.averageChart}>
        <LineChart
          points={points}
          label={t("notes.evolution")}
          formatDate={date => dayMonth.format(date)}
          formatValue={score.format}
        />
      </div>
      <div className={styles.averageFoot}>
        <div>
          <p className={styles.averageValue}>
            {value === undefined ? "-" : score.format(value)}
            <small>/{score.scale}</small>
          </p>
          <Menu
            label={t(`notes.methods.${method}.title`)}
            variant="inline"
            align="start"
            stacked
            items={[
              { kind: "heading", label: t("notes.methodsTitle") },
              ...AVERAGE_METHODS.map(option => ({
                kind: "option" as const,
                label: t(`notes.methods.${option}.title`),
                hint: t(`notes.methods.${option}.text`),
                checked: option === method,
                onSelect: () =>
                  setPreference(
                    "averageMethod",
                    option satisfies AverageMethod
                  ),
              })),
            ]}
          />
        </div>
        <div className={styles.averageAside}>
          {delta !== undefined && (
            <span
              className={styles.deltaChip}
              data-down={delta < 0 || undefined}
            >
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
          {period?.average !== undefined && (
            <small>
              {t("notes.bySchool", { value: score.format(period.average) })}
            </small>
          )}
        </div>
      </div>
    </Card>
  );
}

export function StatsCard({
  period,
  subjects,
  count,
}: {
  period: PeriodView | undefined;
  subjects: readonly SubjectSummary[];
  count: number;
}) {
  const { t } = useTranslation();
  const score = useScore();
  const classValues = subjects.flatMap(
    subject => subject.service?.classAverage ?? []
  );
  const classAverage =
    period?.classAverage ??
    (classValues.length
      ? classValues.reduce((sum, value) => sum + value, 0) / classValues.length
      : undefined);
  const ranked = subjects
    .filter(subject => subject.average !== undefined)
    .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const rows = [
    {
      icon: Apple,
      tone: "text",
      label: t("notes.stats.class"),
      value: classAverage === undefined ? "-" : score.format(classAverage),
    },
    {
      icon: ArrowUp,
      tone: "success",
      label: t("notes.stats.best", { subject: best?.label ?? "-" }),
      value: best?.average === undefined ? "-" : score.format(best.average),
    },
    {
      icon: ArrowDown,
      tone: "error",
      label: t("notes.stats.worst", { subject: worst?.label ?? "-" }),
      value: worst?.average === undefined ? "-" : score.format(worst.average),
    },
    {
      icon: Grades,
      tone: "accent",
      label: t("notes.stats.count"),
      value: String(count),
    },
  ];
  return (
    <Card className={styles.statsCard}>
      <h3>{t("notes.stats.title")}</h3>
      <ul>
        {rows.map(row => (
          <li key={row.tone}>
            <span className={styles.statIcon} data-tone={row.tone}>
              <row.icon size={16} aria-hidden="true" />
            </span>
            <span>{row.label}</span>
            <b>{row.value}</b>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function LatestGrades({
  grades,
  now,
  onOpen,
}: {
  grades: readonly GradeView[];
  now: Date;
  onOpen: (grade: GradeView) => void;
}) {
  const { t } = useTranslation();
  const formats = useDateFormats();
  const score = useScore();
  const latest = [...grades]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5);
  const when = (date: Date) =>
    now.getTime() - date.getTime() < 6 * 86_400_000
      ? formats.relativeDay(date, now)
      : formats.shortDate.format(date);
  if (latest.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby="notes-latest">
      <h3 id="notes-latest" className={styles.sectionHead}>
        <Star size={15} aria-hidden="true" />
        {t("notes.latest")}
      </h3>
      <ul className={styles.latest}>
        {latest.map(grade => (
          <li key={`${grade.serviceId}:${grade.id}`}>
            <button
              type="button"
              className={styles.latestCard}
              style={subjectStyle(grade.color)}
              onClick={() => onOpen(grade)}
            >
              {/* Une ligne chacun : un nom long ne pousse pas la note sur sa date. */}
              <span className={styles.latestSubject} title={grade.label}>
                <span aria-hidden="true">{grade.emoji}</span> {grade.label}
              </span>
              <strong
                className={styles.latestTitle}
                title={grade.title || grade.label}
              >
                {grade.title || grade.label}
              </strong>
              <small>{when(grade.date)}</small>
              <span className={styles.latestValue}>
                {score.grade(grade)}
                <small>/{score.scale}</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
