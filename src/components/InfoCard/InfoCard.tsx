// Carte d'explication avec un titre (« Où trouver cette adresse ? ») : une icône
// d'information, le titre en gras, puis le contenu (phrase ou liste). Pour une simple phrase
// sous un réglage : `Tip`.
import { Info } from "@getpapillon/papicons";
import type { ReactNode } from "react";

import { Card } from "@/components/Card/Card";

import styles from "./InfoCard.module.scss";

export function InfoCard({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className={styles.card}>
      <p className={styles.title}>
        <Info size={16} aria-hidden="true" />
        {title}
      </p>
      <div className={styles.content}>{children}</div>
    </Card>
  );
}
