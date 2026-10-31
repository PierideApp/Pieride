// Champ de texte avec son libellé au-dessus. Les autres attributs vont à l'`<input>`.
// Par défaut dans une carte ; `size="large"` pour un formulaire posé sur la page (premier
// lancement).
import type { InputHTMLAttributes, ReactNode } from "react";

import styles from "./TextField.module.scss";

export function TextField({
  label,
  size = "medium",
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label: ReactNode;
  size?: "medium" | "large";
}) {
  return (
    <label
      className={[styles.field, styles[size], className]
        .filter(Boolean)
        .join(" ")}
    >
      {label}
      <input {...props} />
    </label>
  );
}
