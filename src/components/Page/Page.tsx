// Gabarit d'une page (UX §3) : barre d'outils, puis contenu dans une carte.
// Les zones vides de la barre d'outils déplacent la fenêtre (double-clic : agrandir).
import type { ReactNode } from "react";

import styles from "./Page.module.scss";

export function Page({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <header className={styles.toolbar} data-tauri-drag-region>
        <h1 className={styles.title}>{title}</h1>
      </header>
      <section className={styles.content}>{children}</section>
    </>
  );
}
