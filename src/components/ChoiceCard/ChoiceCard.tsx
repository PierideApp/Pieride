// Grande carte de choix (premier lancement) : icône, titre et phrase, puis à droite une flèche,
// une coche quand elle est choisie, ou une mention (« Bientôt ») quand elle est désactivée.
// Avec `selected`, c'est une option d'un choix unique : à poser dans un `role="radiogroup"`.
import { Check, ChevronRight, type Home } from "@getpapillon/papicons";

import { Chip } from "@/components/Chip/Chip";

import styles from "./ChoiceCard.module.scss";

export function ChoiceCard({
  icon: Icon,
  title,
  text,
  badge,
  selected,
  disabledLabel,
  onClick,
}: {
  icon: typeof Home;
  title: string;
  text: string;
  /** Une pastille après le titre (« Recommandé »). */
  badge?: string;
  /** Défini : option d'un choix unique, cochée ou non. */
  selected?: boolean;
  /** Pas encore disponible : la carte est désactivée et affiche cette mention. */
  disabledLabel?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.card}
      disabled={disabledLabel !== undefined}
      onClick={onClick}
      {...(selected !== undefined && {
        role: "radio",
        "aria-checked": selected,
      })}
    >
      <span className={styles.icon} aria-hidden="true">
        <Icon size={20} />
      </span>
      <span className={styles.text}>
        <strong>
          {title}
          {badge && <Chip>{badge}</Chip>}
        </strong>
        <small>{text}</small>
      </span>
      {disabledLabel !== undefined ? (
        <span className={styles.soon}>{disabledLabel}</span>
      ) : selected ? (
        <span className={styles.check} aria-hidden="true">
          <Check size={14} />
        </span>
      ) : (
        <ChevronRight size={18} className={styles.chevron} aria-hidden="true" />
      )}
    </button>
  );
}
