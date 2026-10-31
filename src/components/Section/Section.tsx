// Une section d'une page de réglages : un petit titre, un élément à sa droite si besoin
// (indication, action), puis son contenu (souvent une `Card`).
import { type ReactNode, useId } from "react";

import styles from "./Section.module.scss";

export function Section({
  title,
  titleId,
  aside,
  level = 3,
  className,
  children,
}: {
  title: ReactNode;
  /** Pour nommer un groupe de la section (`labelledBy`) ; sinon un `id` automatique. */
  titleId?: string;
  aside?: ReactNode;
  /** Niveau du titre : 4 dans une sous-page qui a déjà son titre de niveau 3. */
  level?: 3 | 4;
  className?: string;
  children: ReactNode;
}) {
  const generated = useId();
  const id = titleId ?? generated;
  const Heading = level === 3 ? "h3" : "h4";
  return (
    <section
      className={[styles.section, className].filter(Boolean).join(" ")}
      aria-labelledby={id}
    >
      <div className={styles.head}>
        <Heading id={id} className={styles.title}>
          {title}
        </Heading>
        {aside}
      </div>
      {children}
    </section>
  );
}
