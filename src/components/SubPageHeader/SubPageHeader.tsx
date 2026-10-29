// En-tête d'une sous-page (modifier une matière, fond d'écran) : un lien pour revenir, le
// titre, une phrase, et à droite une action si besoin.
import { ChevronLeft } from "@getpapillon/papicons";
import type { ReactNode } from "react";

import { Button } from "@/components/Button/Button";

import styles from "./SubPageHeader.module.scss";

export function SubPageHeader({
  back,
  onBack,
  title,
  text,
  action,
}: {
  /** Le nom de la page où l'on revient. */
  back: string;
  onBack: () => void;
  title: ReactNode;
  text?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <Button
        variant="ghost"
        icon={ChevronLeft}
        className={styles.back}
        onClick={onBack}
      >
        {back}
      </Button>
      <div className={styles.row}>
        <div>
          <h3 className={styles.title}>{title}</h3>
          {text && <p className={styles.text}>{text}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}
