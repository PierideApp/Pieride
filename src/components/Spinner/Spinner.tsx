// Indicateur d'attente : un cercle qui tourne. Avec `label`, il est lu par les lecteurs
// d'écran ; sans, il est décoratif (un texte à côté dit ce qui se passe).
import styles from "./Spinner.module.scss";

export function Spinner({
  size = "small",
  label,
}: {
  size?: "small" | "large";
  label?: string;
}) {
  return (
    <span
      className={`${styles.spinner} ${styles[size]}`}
      {...(label
        ? { role: "status", "aria-label": label }
        : { "aria-hidden": true })}
    />
  );
}
