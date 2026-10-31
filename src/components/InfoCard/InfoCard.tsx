// Carte d'explication avec un titre (« Où trouver cette adresse ? ») : une icône
// d'information, le titre en gras, puis le contenu (phrase ou liste). Pour une simple phrase
// sous un réglage : `Tip`.
import { AlertCircle, AlertTriangle, Check, Info } from "@getpapillon/papicons";
import type { ReactNode } from "react";

import { Card } from "@/components/Card/Card";

import styles from "./InfoCard.module.scss";

export function InfoCard({
  type,
  title,
  children,
}: {
  type?: "success" | "info" | "warn" | "danger";
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card tone={type} className={styles.card}>
      <p className={styles.title}>
        { (type === "info" || !type) && <Info size={16} aria-hidden="true" /> }
        { type === "danger" && <AlertCircle size={16} aria-hidden="true" /> }
        { type === "success" && <Check size={16} aria-hidden="true" /> }
        { type === "warn" && <AlertTriangle size={16} aria-hidden="true" /> }
        {title}
      </p>
      <div className={styles.content}>{children}</div>
    </Card>
  );
}
