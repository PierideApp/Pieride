// Menu « … » d'une ligne : quelques actions, dans un `<details>` natif (ouvert au clic ou avec
// Entrée, refermé quand on choisit une action).
import { Dots } from "@getpapillon/papicons";

import styles from "./ActionMenu.module.scss";

export interface Action {
  label: string;
  onSelect: () => void;
  /** Action destructrice : en rouge. */
  danger?: boolean;
}

export function ActionMenu({
  label,
  actions,
}: {
  /** Nom du bouton « … », lu par les lecteurs d'écran et affiché au survol. */
  label: string;
  actions: readonly Action[];
}) {
  return (
    <details className={styles.menu}>
      <summary aria-label={label} title={label}>
        <Dots size={18} />
      </summary>
      <div className={styles.list}>
        {actions.map(action => (
          <button
            key={action.label}
            type="button"
            data-danger={action.danger || undefined}
            onClick={event => {
              event.currentTarget.closest("details")?.removeAttribute("open");
              action.onSelect();
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </details>
  );
}
