// Le même gabarit pour les états vides, introuvables et en erreur (UX §5) :
// icône, titre, phrase, action.
import type { Home } from "@getpapillon/papicons";
import type { ReactNode } from "react";

import styles from "./EmptyState.module.scss";

interface EmptyStateProps {
  icon: typeof Home;
  title: string;
  text: string;
  action?: { label: string; onClick: () => void };
  /** Grand texte décoratif au-dessus de l'icône (« 404 »). */
  backdrop?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
  backdrop,
}: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      {backdrop && (
        <p className={styles.backdrop} aria-hidden="true">
          {backdrop}
        </p>
      )}
      <span className={styles.icon} aria-hidden="true">
        <Icon size={24} />
      </span>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.text}>{text}</p>
      {action && (
        <button
          type="button"
          className={styles.action}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
