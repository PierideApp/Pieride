// Onglet Nouvelles notes (maquette 05-notes/02-nouvelles-notes) : toutes les notes de la
// période dans un tableau, triable par matière, date ou note en cliquant sur l'en-tête.
import { ChevronDown, ChevronUp } from "@getpapillon/papicons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/Card/Card";
import type { GradeView } from "@/hooks/useGrades";
import { useScore } from "@/hooks/useScore";
import { type AverageMethod, influence, onTwenty } from "@/lib/grades";
import { subjectStyle } from "@/lib/subjects";
import { useSettingsStore } from "@/stores/settings";

import styles from "./notes.module.scss";

type Column = "subject" | "date" | "value";

export function GradesTable({
  grades,
  all,
  method,
  selected,
  onOpen,
}: {
  /** Les notes affichées (recherche). */
  grades: readonly GradeView[];
  /** Toutes celles de la période, pour l'influence sur la moyenne. */
  all: readonly GradeView[];
  method: AverageMethod;
  selected: string | null;
  onOpen: (grade: GradeView) => void;
}) {
  const { t, i18n } = useTranslation();
  const score = useScore();
  const showCoefficients = useSettingsStore(state => state.showCoefficients);
  const [sort, setSort] = useState<{ column: Column; up: boolean }>({
    column: "date",
    up: false,
  });
  const date = new Intl.DateTimeFormat(i18n.language, {
    day: "numeric",
    month: "long",
  });
  const coefficient = new Intl.NumberFormat(i18n.language, {
    maximumFractionDigits: 2,
  });
  const key = (grade: GradeView) =>
    sort.column === "subject"
      ? grade.label
      : sort.column === "date"
        ? grade.date.getTime()
        : (onTwenty(grade) ?? -1);
  const rows = [...grades].sort((a, b) => {
    const [x, y] = [key(a), key(b)];
    const order =
      typeof x === "string" && typeof y === "string"
        ? x.localeCompare(y, i18n.language)
        : Number(x) - Number(y);
    return sort.up ? order : -order;
  });
  const header = (column: Column, label: string) => (
    <th
      scope="col"
      aria-sort={
        sort.column === column
          ? sort.up
            ? "ascending"
            : "descending"
          : undefined
      }
    >
      <button
        type="button"
        data-active={sort.column === column || undefined}
        onClick={() =>
          setSort({
            column,
            up: sort.column === column ? !sort.up : column === "subject",
          })
        }
      >
        {label}
        {sort.column === column &&
          (sort.up ? (
            <ChevronUp size={14} aria-hidden="true" />
          ) : (
            <ChevronDown size={14} aria-hidden="true" />
          ))}
      </button>
    </th>
  );

  return (
    <Card className={styles.tableCard}>
      <table className={styles.table}>
        <thead>
          <tr>
            {header("subject", t("notes.table.subject"))}
            <th scope="col">{t("notes.table.title")}</th>
            {header("date", t("notes.table.date"))}
            {showCoefficients && (
              <th scope="col" data-end>
                {t("notes.table.coefficient")}
              </th>
            )}
            <th scope="col" data-end>
              {t("notes.table.class")}
            </th>
            <th scope="col" data-end>
              {t("notes.table.influence")}
            </th>
            {header("value", t("notes.table.value"))}
          </tr>
        </thead>
        <tbody>
          {rows.map(grade => {
            const change = influence(all, grade, method);
            return (
              <tr
                key={`${grade.serviceId}:${grade.id}`}
                style={subjectStyle(grade.color)}
                data-selected={selected === grade.id || undefined}
                onClick={() => onOpen(grade)}
              >
                <td className={styles.tableSubject}>
                  <span aria-hidden="true">{grade.emoji}</span> {grade.label}
                </td>
                <td>
                  <button
                    type="button"
                    onClick={event => {
                      // La ligne l'ouvre déjà au clic ; le bouton sert au clavier.
                      event.stopPropagation();
                      onOpen(grade);
                    }}
                  >
                    {grade.title || grade.label}
                  </button>
                </td>
                <td className={styles.tableMuted}>{date.format(grade.date)}</td>
                {showCoefficients && (
                  <td className={styles.tableMuted} data-end>
                    {coefficient.format(grade.coefficient)}
                  </td>
                )}
                <td className={styles.tableMuted} data-end>
                  {grade.classAverage === undefined
                    ? "-"
                    : score.format((grade.classAverage / grade.outOf) * 20)}
                </td>
                <td data-end>
                  {change !== undefined && (
                    <span
                      className={styles.influence}
                      data-down={change < 0 || undefined}
                    >
                      {score.delta(change)}
                    </span>
                  )}
                </td>
                <td data-end className={styles.tableValue}>
                  <b>{score.grade(grade)}</b>
                  <small>/{score.scale}</small>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
