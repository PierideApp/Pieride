// Une matière dans la grille (maquettes : `subject_card`) : emoji, nom et moyenne au-dessus,
// puis une carte avec ses notes. L'étoile marque la meilleure note du groupe.
import { Star } from "@getpapillon/papicons";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/Card/Card";
import type { GradeView } from "@/hooks/useGrades";
import { useScore } from "@/hooks/useScore";
import { subjectStyle } from "@/lib/subjects";

import styles from "./notes.module.scss";
import type { SubjectSummary } from "./subjects";

export function SubjectCard({
  summary,
  selected,
  onOpenSubject,
  onOpenGrade,
}: {
  summary: SubjectSummary;
  selected: string | null;
  onOpenSubject: (summary: SubjectSummary) => void;
  onOpenGrade: (grade: GradeView) => void;
}) {
  const { t, i18n } = useTranslation();
  const score = useScore();
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "long" });
  return (
    <section className={styles.subject} style={subjectStyle(summary.color)}>
      <h3 className={styles.subjectHead}>
        <span aria-hidden="true">{summary.emoji}</span>
        <button type="button" onClick={() => onOpenSubject(summary)}>
          {summary.label}
        </button>
        <b>
          {summary.average === undefined ? "-" : score.format(summary.average)}
        </b>
        <small>/{score.scale}</small>
      </h3>
      <Card rows as="ul" className={styles.gradeList}>
        {summary.grades.map(grade => {
          const best =
            grade.value !== undefined &&
            grade.max !== undefined &&
            grade.value >= grade.max;
          return (
            <li key={grade.id}>
              <button
                type="button"
                className={styles.gradeRow}
                data-selected={selected === grade.id || undefined}
                aria-pressed={selected === grade.id}
                onClick={() => onOpenGrade(grade)}
              >
                <span>
                  <strong>{grade.title || grade.label}</strong>
                  <small>{date.format(grade.date)}</small>
                </span>
                {best && (
                  <span className={styles.bestBadge} title={t("notes.best")}>
                    <Star size={14} aria-label={t("notes.best")} />
                  </span>
                )}
                <b>{score.grade(grade)}</b>
                <small>/{score.scale}</small>
              </button>
            </li>
          );
        })}
      </Card>
    </section>
  );
}
