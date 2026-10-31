// L'emoji d'une matière sur un carré de sa couleur (maquettes : `subj_emoji`) : en tête du
// panneau détail, dans les listes de Notes…
import { subjectStyle } from "@/lib/subjects";

import styles from "./SubjectEmoji.module.scss";

export function SubjectEmoji({
  emoji,
  color,
  size = 30,
}: {
  emoji: string;
  color: string;
  /** Côté du carré, en pixels. */
  size?: 30 | 36 | 48;
}) {
  return (
    <span
      className={styles.emoji}
      data-size={size}
      style={subjectStyle(color)}
      aria-hidden="true"
    >
      {emoji}
    </span>
  );
}
