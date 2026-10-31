// Choix entre deux ou trois options côte à côte (« Tableau | Liste »), sur des boutons radio
// natifs : les flèches passent d'une option à l'autre.
import styles from "./Segmented.module.scss";

export function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
  labelledBy,
  label,
}: {
  /** Nom du groupe de boutons radio, unique dans la page. */
  name: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  /** `id` du texte visible qui nomme le choix. */
  labelledBy?: string;
  /** Nom du choix quand aucun texte visible ne le donne (barre d'outils). */
  label?: string;
}) {
  return (
    <span
      className={styles.segmented}
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
    >
      {options.map(option => (
        <label
          key={option.value}
          data-checked={option.value === value || undefined}
        >
          <input
            type="radio"
            name={name}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </span>
  );
}
