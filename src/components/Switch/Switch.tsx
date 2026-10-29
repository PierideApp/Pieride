// Interrupteur : une case à cocher native (`role="switch"`), redessinée. Dans un `<label>`,
// il prend le texte du label ; sinon, lui donner `aria-label`.
import type { InputHTMLAttributes } from "react";

import styles from "./Switch.module.scss";

export function Switch({
  checked,
  onChange,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "type"> & {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      role="switch"
      className={styles.switch}
      checked={checked}
      onChange={event => onChange(event.target.checked)}
      {...props}
    />
  );
}
