// Un message court dans une carte, à la place d'un contenu qui ne peut pas s'afficher
// (« Ajoute d'abord un compte »). Pour un état vide avec icône et action : `EmptyState`.
import type { ReactNode } from "react";

import { Card } from "@/components/Card/Card";

import styles from "./Notice.module.scss";

export function Notice({ children }: { children: ReactNode }) {
  return (
    <Card>
      <p className={styles.notice}>{children}</p>
    </Card>
  );
}
