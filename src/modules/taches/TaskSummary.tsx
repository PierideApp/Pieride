// Carte de progression de la semaine (maquettes : `summary`) : tâches restantes, une barre par
// tâche, et le prochain rendu sur le jaune de la marque.
import { Clock } from "@getpapillon/papicons";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/Card/Card";
import { useDateFormats } from "@/hooks/useFormats";
import type { HomeworkView } from "@/hooks/useHomework";
import { sameDay, startOfDay } from "@/lib/week";

import styles from "./taches.module.scss";

/** Au-delà, une seule barre : des segments trop fins ne se lisent plus. */
const MAX_SEGMENTS = 14;

export function TaskSummary({
  items,
  now,
}: {
  items: readonly HomeworkView[];
  now: Date;
}) {
  const { t } = useTranslation();
  const formats = useDateFormats();
  const done = items.filter(item => item.done).length;
  const left = items.length - done;
  const next = items.find(
    item => !item.done && item.dueAt >= startOfDay(now)
  )?.dueAt;
  const dueNext = next
    ? items.filter(item => !item.done && sameDay(item.dueAt, next)).length
    : 0;

  return (
    <Card className={styles.summary}>
      <strong className={styles.summaryCount}>{left}</strong>
      <span className={styles.summaryText}>
        <b>{t("taches.left", { count: left })}</b>
        <small>{t("taches.thisWeek")}</small>
      </span>
      <span className={styles.summaryProgress}>
        <span
          className={styles.segments}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={done}
          aria-label={t("taches.doneOf", { done, total: items.length })}
        >
          {items.length > MAX_SEGMENTS ? (
            <span className={styles.segment}>
              <span
                className={styles.segmentFill}
                style={{ "--progress": done / items.length }}
              />
            </span>
          ) : (
            items.map((item, index) => (
              <span
                key={item.id}
                className={styles.segment}
                data-done={index < done || undefined}
              />
            ))
          )}
        </span>
        <small>{t("taches.doneOf", { done, total: items.length })}</small>
      </span>
      {next && (
        <span className={styles.next}>
          <Clock size={16} aria-hidden="true" />
          <span>
            <b>{t("taches.dueFor", { day: formats.relativeDay(next, now) })}</b>
            <small>{t("taches.count", { count: dueNext })}</small>
          </span>
        </span>
      )}
    </Card>
  );
}
