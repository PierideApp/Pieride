// Détail d'un cours dans le panneau de droite (maquette 03-cours/02-semaine-detail-cours) : le
// temps restant s'il a lieu en ce moment, son statut, ses informations, le cahier de textes
// (comme la description d'un devoir, 04-taches/02-tableau-detail), les devoirs de la matière à
// rendre ce jour-là et l'heure de la dernière synchro de la semaine en cours.
import { Clock, MapPin, User } from "@getpapillon/papicons";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";

import { AttachmentList } from "@/components/AttachmentList/AttachmentList";
import { Card } from "@/components/Card/Card";
import { Section } from "@/components/Section/Section";
import { SettingRow } from "@/components/SettingRow/SettingRow";
import { useDateFormats, useFormatDuration } from "@/hooks/useFormats";
import { useHomework } from "@/hooks/useHomework";
import { useServiceSync } from "@/hooks/useLastSync";
import { useNow } from "@/hooks/useNow";
import type { CourseView } from "@/hooks/useTimetable";
import { subjectStyle } from "@/lib/subjects";
import { addDays, sameDay, weekStart } from "@/lib/week";
import { SERVICE_NAMES } from "@/services/shared/plugin";

import styles from "./cours.module.scss";
import { HomeworkList } from "./HomeworkList";

export function CourseDetail({
  accountId,
  course,
}: {
  accountId: string | undefined;
  course: CourseView;
}) {
  const { t } = useTranslation();
  const now = useNow();
  const formats = useDateFormats();
  const duration = useFormatDuration();
  const homework = useHomework(accountId, course.from);
  const lastSync = useServiceSync(course.serviceId, "TIMETABLE");
  const length = (course.to.getTime() - course.from.getTime()) / 60_000;
  const ongoing =
    course.status !== "canceled" && now >= course.from && now < course.to;
  // La synchro ne couvre que la semaine en cours ; les autres sont chargées à la demande.
  const synced =
    lastSync.status === "ready" &&
    lastSync.data &&
    weekStart(course.from).getTime() === weekStart(now).getTime()
      ? lastSync.data
      : null;
  const due = sameDay(course.from, now)
    ? t("cours.dueToday")
    : sameDay(course.from, addDays(now, 1))
      ? t("cours.dueTomorrow")
      : t("cours.dueOn", { day: formats.longDate.format(course.from) });

  const row = (icon: typeof User, title: string, value: string) => (
    <SettingRow icon={icon} tone="subject" title={title} value={value} />
  );

  return (
    <div className={styles.detail} style={subjectStyle(course.color)}>
      {ongoing && (
        <div className={styles.ongoing}>
          <small>{t("cours.now")}</small>
          <strong>
            {t("cours.remaining", {
              duration: duration(
                Math.ceil((course.to.getTime() - now.getTime()) / 60_000)
              ),
            })}
          </strong>
          <span className={styles.ongoingTrack}>
            <progress
              value={(now.getTime() - course.from.getTime()) / 60_000}
              max={length}
              aria-label={t("cours.now")}
            />
          </span>
        </div>
      )}
      {course.status && (
        <p className={styles.detailStatus} data-status={course.status}>
          {t(`cours.statusLong.${course.status}`)}
        </p>
      )}
      <Section title={t("cours.details")}>
        <Card rows>
          {course.teacher && row(User, t("cours.teacher"), course.teacher)}
          {course.room && row(MapPin, t("cours.room"), course.room)}
          {row(User, t("cours.group"), course.group ?? t("cours.wholeClass"))}
          {row(Clock, t("cours.duration"), duration(length))}
        </Card>
      </Section>
      {course.contents && course.contents.length > 0 && (
        <Section title={t("cours.contents")}>
          <div className={styles.contents}>
            {course.contents.map((content, index) => (
              <Fragment key={index}>
                {(content.category || content.title || content.description) && (
                  <Card className={styles.contentCard}>
                    {content.category && <small>{content.category}</small>}
                    {content.title && <strong>{content.title}</strong>}
                    {content.description && <p>{content.description}</p>}
                  </Card>
                )}
                {content.attachments.length > 0 && (
                  <AttachmentList attachments={content.attachments} />
                )}
              </Fragment>
            ))}
          </div>
        </Section>
      )}
      <Section title={t("cours.homeworkForCourse")}>
        <Card className={styles.detailCard}>
          {homework.status === "error" ? (
            <p className={styles.homeworkEmpty} role="alert">
              {t("errors.database")}
            </p>
          ) : (
            <HomeworkList
              items={
                homework.status === "ready"
                  ? homework.data.filter(
                      item =>
                        item.subject === course.subject &&
                        sameDay(item.dueAt, course.from)
                    )
                  : []
              }
              empty={t("cours.noHomeworkForCourse")}
              caption={due}
            />
          )}
        </Card>
      </Section>
      {synced && (
        <p className={styles.detailUpdated}>
          {t("cours.updated", {
            service: SERVICE_NAMES[course.service],
            time: formats.time.format(synced),
          })}
        </p>
      )}
    </div>
  );
}
