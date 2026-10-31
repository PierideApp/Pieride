// Navigation dans le temps de la barre d'outils (Cours, Tâches) : précédent, la période
// affichée (« Semaine 42 », « Jeudi 15 oct. »), suivant, puis « Aujourd'hui ».
import { ChevronLeft, ChevronRight } from "@getpapillon/papicons";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button/Button";

import styles from "./DateNav.module.scss";

export function DateNav({
  label,
  badge,
  onPrevious,
  onNext,
  onToday,
}: {
  /** La période : « Semaine », « Jeudi ». */
  label: string;
  /** Son repère, mis en valeur : « 42 », « 15 oct. ». */
  badge: string;
  onPrevious: () => void;
  onNext: () => void;
  /** Sans lui, pas de bouton « Aujourd'hui » (Tâches). */
  onToday?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.nav}>
      <Button
        className={styles.arrow}
        icon={ChevronLeft}
        aria-label={t("dateNav.previous")}
        onClick={onPrevious}
      />
      <span className={styles.period} aria-live="polite">
        {label} <span className={styles.badge}>{badge}</span>
      </span>
      <Button
        className={styles.arrow}
        icon={ChevronRight}
        aria-label={t("dateNav.next")}
        onClick={onNext}
      />
      {onToday && (
        <Button className={styles.today} onClick={onToday}>
          {t("dateNav.today")}
        </Button>
      )}
    </div>
  );
}
