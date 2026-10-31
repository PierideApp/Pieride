// Gabarit d'une page (UX §3) : barre d'outils, puis contenu dans une carte, ou posé à même le
// panneau (`flat`) comme la grille de Cours. Les zones vides de la barre d'outils déplacent la
// fenêtre (double-clic : agrandir).
import type { ReactNode } from "react";

import styles from "./Page.module.scss";

export function Page({
  title,
  navigation,
  actions,
  flat = false,
  children,
}: {
  title: string;
  /** Juste après le titre : semaine, période… */
  navigation?: ReactNode;
  /** À droite de la barre d'outils : affichage, filtres… */
  actions?: ReactNode;
  /** Contenu sans carte, sur le fond du panneau. */
  flat?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <header className={styles.toolbar} data-tauri-drag-region>
        <h1 className={styles.title}>{title}</h1>
        {navigation}
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      <section className={flat ? styles.flat : styles.content}>
        {children}
      </section>
    </>
  );
}
