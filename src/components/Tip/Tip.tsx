// Encadré d'explication, sous une liste ou un réglage : une icône d'information et un texte.
import { Info } from "@getpapillon/papicons";
import type { ReactNode } from "react";

import styles from "./Tip.module.scss";

export function Tip({ children }: { children: ReactNode }) {
  return (
    <p className={styles.tip}>
      <Info size={18} aria-hidden="true" />
      {children}
    </p>
  );
}
