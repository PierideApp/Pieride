// Menu déroulant de la barre d'outils (maquettes : `dropdown` et `menu`) : un bouton avec son
// icône, puis une liste de choix rangés par groupes, le choix en cours coché. Se ferme au clic
// dehors ou avec Échap ; les flèches passent d'un choix à l'autre.
import { Check, ChevronDown, type Home } from "@getpapillon/papicons";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import styles from "./Menu.module.scss";

export type MenuItem =
  | { kind: "heading"; label: string }
  | { kind: "separator" }
  | {
      kind: "option";
      label: string;
      /** Précision après le libellé (« une colonne par jour »). */
      hint?: string;
      icon?: typeof Home;
      checked?: boolean;
      onSelect: () => void;
    };

export function Menu({
  label,
  icon: Icon,
  value,
  items,
  variant = "button",
  align = "end",
  up = false,
  stacked = false,
}: {
  label: string;
  icon?: typeof Home;
  /** Après le libellé, en couleur d'accent (« Trimestre 1 »). */
  value?: string;
  items: readonly MenuItem[];
  /**
   * `inline` : sans cadre, dans un texte (méthode de calcul sous une moyenne) ; `onBrand` :
   * verre clair sur le fond de la marque (barre « Modifier l'accueil »).
   */
  variant?: "button" | "inline" | "onBrand";
  /** Bord du bouton auquel la liste s'aligne. */
  align?: "start" | "end";
  /** La liste s'ouvre au-dessus du bouton (en bas de la fenêtre). */
  up?: boolean;
  /** Précisions sous les libellés plutôt qu'à côté. */
  stacked?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    // Sans défilement : un parent qui coupe ce qui dépasse défilerait pour montrer l'option.
    root.current
      ?.querySelector<HTMLElement>("[role^=menuitem]")
      ?.focus({ preventScroll: true });
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    event.preventDefault();
    const options = [
      ...(root.current?.querySelectorAll<HTMLElement>("[role^=menuitem]") ??
        []),
    ];
    const index = options.findIndex(
      option => option === document.activeElement
    );
    const step = event.key === "ArrowDown" ? 1 : -1;
    options[(index + step + options.length) % options.length]?.focus();
  };

  return (
    <div className={styles.root} ref={root} onKeyDown={onKeyDown}>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        data-variant={variant}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {Icon && <Icon size={16} aria-hidden="true" />}
        {label}
        {value && <span className={styles.value}>{value}</span>}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={id}
          className={styles.list}
          data-align={align}
          data-up={up || undefined}
          data-stacked={stacked || undefined}
          role="menu"
          aria-label={label}
        >
          {items.map((item, index) =>
            item.kind === "separator" ? (
              <hr key={index} className={styles.separator} />
            ) : item.kind === "heading" ? (
              <p key={index} className={styles.heading} role="presentation">
                {item.label}
              </p>
            ) : (
              <button
                key={index}
                type="button"
                className={styles.option}
                role="menuitemcheckbox"
                aria-checked={item.checked ?? false}
                tabIndex={-1}
                onClick={() => {
                  item.onSelect();
                  setOpen(false);
                  trigger.current?.focus();
                }}
              >
                {item.icon && <item.icon size={16} aria-hidden="true" />}
                <span className={styles.label}>
                  {item.label}
                  {item.hint && <small>{item.hint}</small>}
                </span>
                {item.checked && <Check size={14} aria-hidden="true" />}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
