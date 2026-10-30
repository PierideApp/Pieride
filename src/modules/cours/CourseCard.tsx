// Un cours (maquettes : `course_card`) : fond dégradé de la couleur de sa matière, trait
// vertical, nom, salle, enseignant et statut. `compact` dans la grille de la semaine, `full`
// dans la liste du jour. Ouvre son détail au clic.
import { MapPin, User } from "@getpapillon/papicons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { CourseView } from "@/hooks/useTimetable";
import { subjectStyle } from "@/lib/subjects";

import styles from "./cours.module.scss";

/** Dans la grille : la salle à partir d'environ 35 minutes, l'enseignant à partir de 50. */
function compactSize(course: CourseView): "s" | "m" | "l" {
  const minutes = (course.to.getTime() - course.from.getTime()) / 60_000;
  return minutes >= 50 ? "l" : minutes >= 35 ? "m" : "s";
}

export function CourseCard({
  course,
  variant,
  selected,
  badge,
  onOpen,
  children,
}: {
  course: CourseView;
  variant: "compact" | "full";
  /** Son détail est ouvert dans le panneau. */
  selected: boolean;
  /** Pastille à la place de celle du statut (« En cours · encore 33 min »). */
  badge?: ReactNode;
  onOpen: (course: CourseView) => void;
  /** Sous la salle et l'enseignant : la durée… */
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const iconSize = variant === "compact" ? 11 : 13;
  return (
    <button
      type="button"
      className={styles.course}
      style={subjectStyle(course.color)}
      data-variant={variant}
      data-size={variant === "compact" ? compactSize(course) : undefined}
      data-status={course.status}
      data-selected={selected || undefined}
      aria-pressed={selected}
      onClick={() => onOpen(course)}
    >
      <span className={styles.courseBar} aria-hidden="true" />
      <span className={styles.courseHead}>
        <span className={styles.courseName}>{course.label}</span>
        {badge ??
          (course.status && (
            <span className={styles.status}>
              {t(
                `${variant === "compact" ? "cours.status" : "cours.statusLong"}.${course.status}`
              )}
            </span>
          ))}
      </span>
      {(course.room || course.teacher) && (
        <span className={styles.courseMeta}>
          {course.room && (
            <span className={styles.courseRoom}>
              <MapPin size={iconSize} aria-hidden="true" />
              {course.room}
            </span>
          )}
          {course.teacher && (
            <span className={styles.courseTeacher}>
              <User size={iconSize} aria-hidden="true" />
              {course.teacher}
            </span>
          )}
        </span>
      )}
      {children}
    </button>
  );
}
