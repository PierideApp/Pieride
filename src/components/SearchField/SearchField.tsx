// Champ de recherche avec sa loupe. Le texte d'exemple sert aussi de nom (`aria-label`).
import { Search } from "@getpapillon/papicons";

import styles from "./SearchField.module.scss";

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className={styles.field}>
      <Search size={16} aria-hidden="true" />
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={event => onChange(event.target.value)}
      />
    </label>
  );
}
