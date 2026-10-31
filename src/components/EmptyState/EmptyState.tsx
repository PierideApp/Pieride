// Le même gabarit pour les états vides, introuvables et en erreur (UX §5) :
// icône, titre, phrase, action.
import type { Home } from "@getpapillon/papicons";
import type { ReactNode } from "react";

import { Button } from "@/components/Button/Button";

import styles from "./EmptyState.module.scss";

interface EmptyStateProps {
  icon: typeof Home;
  title: string;
  text: string;
  action?: { label: string; onClick: () => void };
  /** Grand texte décoratif au-dessus de l'icône (« 404 »). */
  backdrop?: ReactNode;
  /** `small` : dans un petit bloc (widget de l'accueil). */
  size?: "medium" | "small";
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
  backdrop,
  size = "medium",
}: EmptyStateProps) {
  return (
    <div className={styles.empty} data-size={size}>
      {backdrop && (
        <p className={styles.backdrop} aria-hidden="true">
          {backdrop}
        </p>
      )}
      <span className={styles.icon} aria-hidden="true">
        <Icon size={size === "small" ? 20 : 24} />
      </span>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.text}>{text}</p>
      {action && (
        <Button
          variant="primary"
          className={styles.action}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
