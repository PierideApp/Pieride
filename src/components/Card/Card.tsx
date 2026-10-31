// Carte blanche aux coins très arrondis (UX §10). `rows` : une liste de lignes séparées par
// un filet (`SettingRow`, ou des `<li>` qui en contiennent une). `tone="success"` : une
// réussite à signaler (adresse vérifiée…), en vert.
import type { HTMLAttributes } from "react";

import styles from "./Card.module.scss";

export function Card({
  as: Tag = "div",
  rows = false,
  tone,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & {
  as?: "div" | "ul" | "ol" | "section";
  rows?: boolean;
  tone?: "success";
}) {
  return (
    <Tag
      className={[styles.card, rows && styles.rows, className]
        .filter(Boolean)
        .join(" ")}
      data-tone={tone}
      {...props}
    />
  );
}
