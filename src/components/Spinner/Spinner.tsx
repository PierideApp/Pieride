// Indicateur d'attente : un cercle qui tourne. Avec `label`, il est lu par les lecteurs
// d'écran ; sans, il est décoratif (un texte à côté dit ce qui se passe). `fill` : à la place
// d'un contenu encore en route (lecture de la base, synchro), centré dans la place libre.
import styles from "./Spinner.module.scss";

export function Spinner({
  size = "small",
  label,
  fill = false,
}: {
  size?: "small" | "large";
  label?: string;
  /** Centré dans la place libre, et visible seulement après un court délai. */
  fill?: boolean;
}) {
  const spinner = (
    <span
      className={`${styles.spinner} ${styles[size]}`}
      {...(label
        ? { role: "status", "aria-label": label }
        : { "aria-hidden": true })}
    />
  );
  return fill ? <div className={styles.fill}>{spinner}</div> : spinner;
}
