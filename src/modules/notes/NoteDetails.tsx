// Panneaux détail de Notes : une note (maquette 05-notes/03-detail-note) et une matière
// (05-notes/04-statistiques-matiere), avec leurs chiffres et leur influence.
import {
  Apple,
  ArrowDown,
  ArrowUp,
  Coefficient,
  Grades,
  Minus,
  Plus,
  Star,
} from "@getpapillon/papicons";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/Card/Card";
import { LineChart } from "@/components/LineChart/LineChart";
import { Section } from "@/components/Section/Section";
import { SettingRow } from "@/components/SettingRow/SettingRow";
import type { GradeView } from "@/hooks/useGrades";
import { useScore } from "@/hooks/useScore";
import { type AverageMethod, history, influence, onTwenty } from "@/lib/grades";
import { subjectStyle } from "@/lib/subjects";
import { useSettingsStore } from "@/stores/settings";

import styles from "./notes.module.scss";
import type { SubjectSummary } from "./subjects";

export function GradeDetail({
  grade,
  all,
  method,
}: {
  grade: GradeView;
  /** Les notes de la période, pour l'influence sur la moyenne. */
  all: readonly GradeView[];
  method: AverageMethod;
}) {
  const { t, i18n } = useTranslation();
  const score = useScore();
  const showCoefficients = useSettingsStore(state => state.showCoefficients);
  const number = new Intl.NumberFormat(i18n.language, {
    maximumFractionDigits: 2,
  });
  const twenty = (value: number | undefined) =>
    value === undefined || grade.outOf <= 0
      ? undefined
      : (value / grade.outOf) * 20;
  const value = onTwenty(grade);
  // L'autre échelle courante : sur 10 pour une note sur 20, sur 20 sinon.
  const other = score.scale === 20 ? 10 : 20;
  const change = influence(all, grade, method);
  const gap =
    value !== undefined && grade.classAverage !== undefined
      ? value - (twenty(grade.classAverage) ?? 0)
      : undefined;
  const chip = (delta: number) => (
    <span className={styles.influence} data-down={delta < 0 || undefined}>
      {score.delta(delta)}
    </span>
  );

  return (
    <div className={styles.detail} style={subjectStyle(grade.color)}>
      <div className={styles.detailHero}>
        <p className={styles.heroValue}>
          {score.grade(grade)}
          <small>/{score.scale}</small>
        </p>
        <span className={styles.heroChips}>
          {showCoefficients && (
            <span>
              <Coefficient size={12} aria-hidden="true" />
              {t("notes.coefficient", {
                value: number.format(grade.coefficient),
              })}
            </span>
          )}
          {grade.classAverage !== undefined && (
            <span>
              <Apple size={12} aria-hidden="true" />
              {t("notes.groupAverage", {
                value: score.format(twenty(grade.classAverage) ?? 0),
              })}
            </span>
          )}
        </span>
      </div>
      <Section title={t("notes.details")}>
        <Card rows>
          {value !== undefined && (
            <SettingRow
              icon={Star}
              tone="subject"
              title={t("notes.scaled")}
              text={t("notes.scaledText", { scale: other })}
              value={`${number.format((value / 20) * other)}/${other}`}
            />
          )}
          {grade.max !== undefined && (
            <SettingRow
              icon={Plus}
              tone="subject"
              title={t("notes.highest")}
              text={t("notes.highestText")}
              value={score.format(twenty(grade.max) ?? 0)}
            />
          )}
          {grade.min !== undefined && (
            <SettingRow
              icon={Minus}
              tone="subject"
              title={t("notes.lowest")}
              text={t("notes.lowestText")}
              value={score.format(twenty(grade.min) ?? 0)}
            />
          )}
        </Card>
      </Section>
      {(change !== undefined || gap !== undefined) && (
        <Section title={t("notes.influenceTitle")}>
          <Card rows>
            {change !== undefined && (
              <SettingRow
                icon={Grades}
                tone="subject"
                title={t("notes.overall")}
              >
                {chip(change)}
              </SettingRow>
            )}
            {gap !== undefined && (
              <SettingRow
                icon={Apple}
                tone="subject"
                title={t("notes.toGroup")}
              >
                {chip(gap)}
              </SettingRow>
            )}
          </Card>
        </Section>
      )}
    </div>
  );
}

export function SubjectDetail({ summary }: { summary: SubjectSummary }) {
  const { t, i18n } = useTranslation();
  const score = useScore();
  const date = new Intl.DateTimeFormat(i18n.language, {
    day: "numeric",
    month: "long",
  });
  const points = history(summary.grades, "weighted");
  const rows = [
    {
      icon: Apple,
      title: t("notes.subjectStats.class"),
      text: t("notes.subjectStats.classText"),
      value: summary.service?.classAverage,
    },
    {
      icon: ArrowUp,
      title: t("notes.subjectStats.max"),
      text: t("notes.subjectStats.maxText"),
      value: summary.service?.max,
    },
    {
      icon: ArrowDown,
      title: t("notes.subjectStats.min"),
      text: t("notes.subjectStats.minText"),
      value: summary.service?.min,
    },
  ].filter(row => row.value !== undefined);

  return (
    <div className={styles.detail} style={subjectStyle(summary.color)}>
      <div className={styles.detailHero} data-subject>
        <small>{t("notes.studentAverage")}</small>
        <p className={styles.heroValue}>
          {summary.average === undefined ? "-" : score.format(summary.average)}
          <small>/{score.scale}</small>
        </p>
        <div className={styles.heroChart}>
          <LineChart
            points={points}
            label={t("notes.evolution")}
            formatDate={value => date.format(value)}
            formatValue={score.format}
            hover={false}
          />
        </div>
      </div>
      {rows.length > 0 && (
        <Section title={t("notes.stats.title")}>
          <Card rows>
            {rows.map(row => (
              <SettingRow
                key={row.title}
                icon={row.icon}
                tone="subject"
                title={row.title}
                text={row.text}
                value={score.format(row.value ?? 0)}
              />
            ))}
          </Card>
        </Section>
      )}
    </div>
  );
}
