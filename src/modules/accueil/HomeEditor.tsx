// Mode « Modifier l'accueil » (maquette 02-accueil/02-accueil-modifier) : chaque widget a un
// contour pointillé, une poignée de six points, une barre de tailles et un bouton pour le
// retirer ; une barre en bas annule, rétablit, ajoute ou termine.
// Pendant un glisser, la disposition se réorganise en direct : le widget s'insère avant ou après
// celui qu'il survole, devient une carte dans la rangée du haut et retrouve sa taille en
// redescendant. Les gestes sont suivis sur la fenêtre (événements `pointer`) : un widget qui
// change de place ou de zone ne les interrompt pas. La page ne se redessine que quand la place
// visée change : entre-temps, la copie suit le pointeur par ses variables CSS.
import { Minus, Plus } from "@getpapillon/papicons";
import {
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button/Button";
import { Menu, type MenuItem } from "@/components/Menu/Menu";
import type { HomeItem, HomeWidget, WidgetSize } from "@/stores/settings";

import styles from "./accueil.module.scss";
import {
  type Drop,
  dropItem,
  isMini,
  sizesOf,
  spanOf,
  stepSize,
} from "./layout";

/** Flèches : une place (ou une taille) avant ou après. */
const STEPS: Record<string, 1 | -1> = {
  ArrowLeft: -1,
  ArrowUp: -1,
  ArrowRight: 1,
  ArrowDown: 1,
};

/** En dessous, un appui reste un clic : on ne glisse pas. */
const DRAG_THRESHOLD = 4;

export interface DragState {
  id: HomeWidget;
  /** Où il sera posé ; `null` tant qu'il n'a rien survolé. */
  drop: Drop | null;
  /** Coin haut gauche de la copie à la dernière place visée, et sa taille au départ. */
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Gesture {
  id: HomeWidget;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  moved: boolean;
}

const sameDrop = (a: Drop | null, b: Drop | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    (a.kind === "end"
      ? b.kind === "end" && a.zone === b.zone
      : b.kind === a.kind && b.target === a.target));

const inside = (element: Element | null | undefined, x: number, y: number) => {
  const box = element?.getBoundingClientRect();
  return (
    !!box && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom
  );
};

export function useHomeEditor({
  layout,
  strip,
  grid,
  copy,
  onCommit,
}: {
  layout: readonly HomeItem[];
  /** La rangée des cartes et la grille du bas. */
  strip: RefObject<HTMLElement | null>;
  grid: RefObject<HTMLElement | null>;
  /** La copie qui suit le pointeur (`DragCopy`). */
  copy: RefObject<HTMLElement | null>;
  onCommit: (layout: HomeItem[]) => void;
}) {
  const elements = useRef(new Map<HomeWidget, HTMLElement>());
  const gesture = useRef<Gesture | null>(null);
  const [active, setActive] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  // Les dernières valeurs, lues par les écouteurs de la fenêtre.
  const latest = useRef({ layout, onCommit, drag });
  useEffect(() => {
    latest.current = { layout, onCommit, drag };
  });

  /** Où poser `id` sous le pointeur ; sur sa propre place ou hors des zones, rien ne change. */
  const dropAt = (
    id: HomeWidget,
    x: number,
    y: number,
    current: Drop | null
  ): Drop | null => {
    if (inside(elements.current.get(id), x, y)) {
      return current;
    }
    for (const [other, element] of elements.current) {
      if (other !== id && inside(element, x, y)) {
        const box = element.getBoundingClientRect();
        return {
          kind: x < box.left + box.width / 2 ? "before" : "after",
          target: other,
        };
      }
    }
    // Dans une zone mais entre deux widgets : on garde la cible tant qu'elle est dans cette
    // zone (sinon le widget sauterait à la fin à chaque passage dans un espace).
    for (const [zone, element] of [
      ["strip", strip.current],
      ["grid", grid.current],
    ] as const) {
      if (inside(element, x, y)) {
        return current && zoneOf(current) === zone
          ? current
          : { kind: "end", zone };
      }
    }
    return current;
  };

  /** La zone d'une cible : celle du widget visé, ou celle de la fin visée. */
  const zoneOf = (drop: Drop) => {
    if (drop.kind === "end") {
      return drop.zone;
    }
    const target = latest.current.layout.find(item => item.id === drop.target);
    return target && isMini(target.size) ? "strip" : "grid";
  };

  useEffect(() => {
    if (!active) {
      return;
    }
    const onMove = (event: PointerEvent) => {
      const current = gesture.current;
      if (!current) {
        return;
      }
      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;
      if (!current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) {
        return;
      }
      current.moved = true;
      const previous = latest.current.drag;
      const drop = dropAt(
        current.id,
        event.clientX,
        event.clientY,
        previous?.drop ?? null
      );
      const x = event.clientX - current.offsetX;
      const y = event.clientY - current.offsetY;
      // Même place visée : seule la copie bouge, sans redessiner la page.
      if (previous && copy.current && sameDrop(previous.drop, drop)) {
        copy.current.style.setProperty("--drag-x", `${x}px`);
        copy.current.style.setProperty("--drag-y", `${y}px`);
        return;
      }
      setDrag({
        id: current.id,
        drop,
        x,
        y,
        width: current.width,
        height: current.height,
      });
    };
    const onUp = () => {
      const current = gesture.current;
      const { layout: now, drag: dragged } = latest.current;
      gesture.current = null;
      setActive(false);
      setDrag(null);
      if (current && dragged?.drop) {
        latest.current.onCommit(dropItem(now, current.id, dragged.drop));
      }
    };
    const onCancel = () => {
      gesture.current = null;
      setActive(false);
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
    // Les fonctions lisent `latest` et les éléments : seul le début du geste compte.
     
  }, [active]);

  const slotProps = (id: HomeWidget) => ({
    ref: (element: HTMLElement | null) => {
      if (element) {
        elements.current.set(id, element);
      } else {
        elements.current.delete(id);
      }
    },
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      const box = event.currentTarget.getBoundingClientRect();
      gesture.current = {
        id,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: event.clientX - box.left,
        offsetY: event.clientY - box.top,
        width: box.width,
        height: box.height,
        moved: false,
      };
      setActive(true);
    },
  });

  // La disposition affichée : celle enregistrée, avec le glisser en cours appliqué.
  const preview = drag?.drop ? dropItem(layout, drag.id, drag.drop) : layout;

  return { drag, preview, slotProps };
}

/** La forme d'une taille : un rectangle proportionnel à ses colonnes et lignes. */
function SizeIcon({ id, size }: { id: HomeWidget; size: WidgetSize }) {
  const [cols, rows] = spanOf(id, size);
  const width = Math.max(4, (cols / 12) * 18);
  const height = Math.max(3, (Math.min(rows, 8) / 8) * 12);
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true">
      <rect
        x="1"
        y="1"
        width="20"
        height="14"
        rx="3"
        className={styles.iconFrame}
      />
      <rect x="2" y="2" width={width} height={height} rx="1.5" />
    </svg>
  );
}

export function WidgetSlot({
  id,
  name,
  size,
  before,
  after,
  editing,
  editor,
  onMove,
  onResize,
  onRemove,
  children,
}: {
  id: HomeWidget;
  /** Nom du widget, pour les poignées et les boutons. */
  name: string;
  /** Taille affichée (celle de l'aperçu pendant un geste). */
  size: WidgetSize;
  /** Les widgets voisins de sa zone, pour le déplacer aux flèches. */
  before: HomeWidget | undefined;
  after: HomeWidget | undefined;
  editing: boolean;
  editor: ReturnType<typeof useHomeEditor>;
  onMove: (id: HomeWidget, drop: Drop) => void;
  onResize: (id: HomeWidget, size: WidgetSize) => void;
  onRemove: (id: HomeWidget) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [cols, rows] = spanOf(id, size);
  const placeholder = editor.drag?.id === id;
  const onMoveKey = (event: KeyboardEvent) => {
    const step = STEPS[event.key];
    if (!step) {
      return;
    }
    event.preventDefault();
    // Maj + flèche : la taille ; flèche seule : la place parmi les widgets de sa zone.
    if (event.shiftKey) {
      onResize(id, stepSize(id, size, step));
      return;
    }
    const target = step < 0 ? before : after;
    if (target) {
      onMove(id, { kind: step < 0 ? "before" : "after", target });
    }
  };
  return (
    <div
      className={styles.slot}
      data-flip-id={id}
      data-size={size}
      data-editing={editing || undefined}
      data-placeholder={placeholder || undefined}
      style={{
        "--cols": cols,
        "--cols-narrow": Math.ceil(cols / 2),
        "--rows": rows,
      }}
      {...(editing ? editor.slotProps(id) : {})}
    >
      {/* En modification, le widget ne réagit plus : on le déplace. */}
      <div className={styles.slotContent} inert={editing}>
        {children}
      </div>
      {editing && (
        <>
          <button
            type="button"
            className={styles.handle}
            aria-label={t("accueil.move", { name })}
            title={t("accueil.moveHint")}
            onKeyDown={onMoveKey}
          >
            {/* Six points, comme la maquette : deux rangées de trois, à 6 px d'écart. */}
            <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true">
              {[3, 9, 15].flatMap(x =>
                [3, 9].map(y => (
                  <circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" />
                ))
              )}
            </svg>
          </button>
          <div
            className={styles.toolbar}
            role="radiogroup"
            aria-label={t("accueil.sizeOf", { name })}
            onPointerDown={event => event.stopPropagation()}
          >
            {sizesOf(id).map(option => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={option === size}
                aria-label={t(`accueil.sizes.${option}`)}
                title={t(`accueil.sizes.${option}`)}
                onClick={() => onResize(id, option)}
              >
                <SizeIcon id={id} size={option} />
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.remove}
            aria-label={t("accueil.remove", { name })}
            // Pas de glissement depuis le bouton : il garderait le clic.
            onPointerDown={event => event.stopPropagation()}
            onClick={() => onRemove(id)}
          >
            <Minus size={16} aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}

/** La copie du widget glissé, qui suit le pointeur au-dessus de tout. */
export function DragCopy({
  drag,
  ref,
  children,
}: {
  drag: DragState;
  /** Pour la déplacer sans rendu (`useHomeEditor`). */
  ref: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  return (
    <div
      ref={ref}
      className={styles.dragCopy}
      style={{
        "--drag-x": `${drag.x}px`,
        "--drag-y": `${drag.y}px`,
        "--drag-w": `${drag.width}px`,
        "--drag-h": `${drag.height}px`,
      }}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

export function EditBar({
  addable,
  onCancel,
  onReset,
  onDone,
}: {
  /** Widgets masqués, à remettre. */
  addable: readonly MenuItem[];
  /** Revient à l'accueil d'avant la modification. */
  onCancel: () => void;
  /** Revient à la disposition de la maquette. */
  onReset: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={styles.editBar}
      role="toolbar"
      aria-label={t("accueil.edit")}
    >
      <p>{t("accueil.editHint")}</p>
      <Button variant="onBrand" className={styles.barButton} onClick={onCancel}>
        {t("accueil.cancel")}
      </Button>
      <Button variant="onBrand" className={styles.barButton} onClick={onReset}>
        {t("accueil.reset")}
      </Button>
      <Menu
        label={t("accueil.addWidget")}
        icon={Plus}
        variant="onBrand"
        up
        items={
          addable.length > 0
            ? addable
            : [{ kind: "heading", label: t("accueil.allShown") }]
        }
      />
      <Button variant="onBrandSolid" onClick={onDone}>
        {t("accueil.done")}
      </Button>
    </div>
  );
}

/** Après un retrait : quelques secondes pour annuler. */
export function UndoToast({
  name,
  onUndo,
}: {
  name: string;
  onUndo: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.toast} role="status">
      <span>{t("accueil.removed", { name })}</span>
      <button type="button" onClick={onUndo}>
        {t("accueil.undo")}
      </button>
    </div>
  );
}

/** Rangée du haut vide en modification : on y dépose un widget pour en faire une carte. */
export function StripHint() {
  const { t } = useTranslation();
  return <p className={styles.stripHint}>{t("accueil.stripHint")}</p>;
}
