// Liste déroulante aux couleurs de Piéride, à utiliser partout à la place de `<select>`, dont
// la liste native suit le système et pas le thème. Un bouton ouvre une liste d'options (motif
// « listbox » de l'ARIA). Au clavier : flèches, Début, Fin, Entrée ou Espace, Échap.
// Ne pas la mettre dans un `<label>` : un clic dans la liste rouvrirait le bouton.
import { Check, ChevronDown } from "@getpapillon/papicons";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import styles from "./Select.module.scss";

export interface SelectOption<T> {
  value: T;
  label: string;
}

export function Select<T extends string | number>({
  value,
  options,
  onChange,
  labelledBy,
}: {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  /** `id` du texte visible qui nomme la liste. */
  labelledBy: string;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const selected = Math.max(
    0,
    options.findIndex(option => option.value === value)
  );
  /** L'option mise en avant au clavier ou au survol. */
  const [active, setActive] = useState(selected);

  // Ouverte : le focus passe à la liste ; un clic ailleurs la referme.
  useEffect(() => {
    if (!open) {
      return;
    }
    list.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const show = () => {
    setActive(selected);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const choose = (index: number) => {
    const option = options[index];
    if (option && option.value !== value) {
      onChange(option.value);
    }
    close();
  };

  const onButtonKey = (event: KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      show();
    }
  };
  const onListKey = (event: KeyboardEvent) => {
    const last = options.length - 1;
    const moves: Partial<Record<string, number>> = {
      ArrowDown: Math.min(active + 1, last),
      ArrowUp: Math.max(active - 1, 0),
      Home: 0,
      End: last,
    };
    const next = moves[event.key];
    if (next !== undefined) {
      event.preventDefault();
      setActive(next);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Escape") {
      // Ferme la liste seulement, pas la fenêtre qui la contient (Paramètres).
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={root} className={styles.select}>
      <button
        ref={button}
        type="button"
        className={styles.button}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-labelledby={`${labelledBy} ${id}-value`}
        onClick={() => (open ? close() : show())}
        onKeyDown={onButtonKey}
      >
        <span id={`${id}-value`}>{options[selected]?.label}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <ul
          ref={list}
          id={`${id}-list`}
          role="listbox"
          tabIndex={-1}
          className={styles.list}
          aria-labelledby={labelledBy}
          aria-activedescendant={`${id}-${active}`}
          onKeyDown={onListKey}
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${id}-${index}`}
              role="option"
              aria-selected={index === selected}
              data-active={index === active || undefined}
              onPointerEnter={() => setActive(index)}
              onClick={() => choose(index)}
            >
              {option.label}
              {index === selected && <Check size={14} aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
