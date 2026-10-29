// Petite pastille de texte : un état (« Installée », « Recommandé ») en vert, ou une étiquette
// (le nom d'un service) aux couleurs de l'accent.
import type { ReactNode } from "react";

import styles from "./Chip.module.scss";

export function Chip({
  tone = "success",
  children,
}: {
  tone?: "success" | "accent";
  children: ReactNode;
}) {
  return <span className={`${styles.chip} ${styles[tone]}`}>{children}</span>;
}
