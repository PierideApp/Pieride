// Une ligne de réglage (maquettes 07-parametres) : icône (ou `media` : photo, poignée…), titre
// et phrase, puis à droite une valeur ou ce qu'on règle (interrupteur, liste, bouton…).
// À poser dans une `Card rows`. `as="button"` pour une ligne cliquable, `as="label"` pour
// qu'un clic sur le texte active le contrôle.
import type { Home } from "@getpapillon/papicons";
import {
  type ButtonHTMLAttributes,
  createElement,
  type ReactNode,
} from "react";

import styles from "./SettingRow.module.scss";

export function SettingRow({
  as = "div",
  icon: Icon,
  media,
  title,
  titleId,
  text,
  value,
  tone,
  className,
  children,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLElement>, "title"> & {
  as?: "div" | "li" | "label" | "button";
  icon?: typeof Home;
  /** À gauche, avant l'icône : photo, aperçu, poignée pour réordonner… */
  media?: ReactNode;
  title: ReactNode;
  /** Pour nommer un contrôle de la ligne (`labelledBy`). */
  titleId?: string;
  text?: ReactNode;
  /** Une valeur affichée à droite (établissement, version…). */
  value?: ReactNode;
  /** `danger` : action destructrice ; `success` : engagement tenu. */
  tone?: "danger" | "success";
}) {
  return createElement(
    as,
    {
      className: [styles.row, className].filter(Boolean).join(" "),
      "data-tone": tone,
      ...(as === "button" ? { type: "button" } : {}),
      ...props,
    },
    media,
    Icon && (
      <span className={styles.icon} aria-hidden="true">
        <Icon size={18} />
      </span>
    ),
    <span className={styles.text}>
      <strong id={titleId}>{title}</strong>
      {text && <small>{text}</small>}
    </span>,
    value !== undefined && <span className={styles.value}>{value}</span>,
    children
  );
}
