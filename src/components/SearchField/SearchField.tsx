// Champ de recherche avec sa loupe. Le texte d'exemple sert aussi de nom (`aria-label`).
// `size="large"` : sur toute la largeur, pour un formulaire posé sur la page (premier lancement).
import { Search } from "@getpapillon/papicons";

import styles from "./SearchField.module.scss";

export function SearchField({
  value,
  onChange,
  placeholder,
  size = "medium",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  size?: "medium" | "large";
}) {
  return (
    <label className={`${styles.field} ${styles[size]}`}>
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
