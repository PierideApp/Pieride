// Choix d'une couleur parmi des pastilles rondes (couleur d'accentuation, couleur d'une
// matière), sur des boutons radio natifs : les flèches passent d'une couleur à l'autre.
import { Check } from "@getpapillon/papicons";

import styles from "./ColorSwatches.module.scss";

export function ColorSwatches<T extends string>({
  name,
  value,
  options,
  onChange,
  labelledBy,
}: {
  /** Nom du groupe de boutons radio, unique dans la page. */
  name: string;
  value: T;
  /** `label` : le nom lu par les lecteurs d'écran et affiché au survol. */
  options: readonly { value: T; color: string; label: string }[];
  onChange: (value: T) => void;
  /** `id` du texte visible qui nomme le choix. */
  labelledBy: string;
}) {
  return (
    <div
      className={styles.swatches}
      role="radiogroup"
      aria-labelledby={labelledBy}
    >
      {options.map(option => (
        <label
          key={option.value}
          className={styles.swatch}
          style={{ color: option.color }}
          title={option.label}
          data-checked={option.value === value || undefined}
        >
          <input
            type="radio"
            name={name}
            aria-label={option.label}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          <Check size={16} aria-hidden="true" />
        </label>
      ))}
    </div>
  );
}
