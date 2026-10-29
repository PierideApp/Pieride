// Les boutons de l'app. `secondary` par défaut ; `primary` pour l'action attendue ; `danger`
// pour une action destructrice proposée, `dangerSolid` pour la confirmer ; `ghost` pour une
// action secondaire sans cadre (Retour, Annuler) ; `onBrand` et `onBrandSolid` sur le fond
// indigo de la marque ; `link` pour une action discrète dans un texte ou un titre.
// `size="large"` : écrans en grand format (premier lancement).
import type { Home } from "@getpapillon/papicons";
import type { ButtonHTMLAttributes } from "react";

import styles from "./Button.module.scss";

export type ButtonVariant =
  | "secondary"
  | "primary"
  | "danger"
  | "dangerSolid"
  | "ghost"
  | "onBrand"
  | "onBrandSolid"
  | "link";

export function Button({
  variant = "secondary",
  size = "medium",
  icon: Icon,
  trailingIcon: TrailingIcon,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "medium" | "large";
  /** Avant le texte. */
  icon?: typeof Home;
  /** Après le texte (lien externe…). */
  trailingIcon?: typeof Home;
}) {
  return (
    <button
      type="button"
      className={[styles.button, styles[variant], styles[size], className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {Icon && <Icon size={size === "large" ? 18 : 16} aria-hidden="true" />}
      {children}
      {TrailingIcon && <TrailingIcon size={14} aria-hidden="true" />}
    </button>
  );
}
