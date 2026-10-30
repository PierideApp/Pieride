// Fait glisser en douceur les éléments qui changent de place (technique FLIP) : après chaque
// rendu, chaque élément marqué `data-flip-id` dans `container` part de son ancienne position
// et rejoint la nouvelle. Positions mesurées dans le conteneur, pour qu'un défilement ne fasse
// rien bouger. Rien ne s'anime si le système demande moins d'animations. Chaque mesure force
// une mise en page : `active` la limite au moment où les éléments peuvent bouger.
import { type RefObject, useLayoutEffect, useRef } from "react";

const DURATION = 220;

export function useFlip(
  container: RefObject<HTMLElement | null>,
  active = true
) {
  const boxes = useRef(new Map<string, { x: number; y: number }>());

  useLayoutEffect(() => {
    const root = container.current;
    if (!root || !active) {
      boxes.current.clear();
      return;
    }
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const origin = root.getBoundingClientRect();
    const next = new Map<string, { x: number; y: number }>();
    for (const element of root.querySelectorAll<HTMLElement>(
      "[data-flip-id]"
    )) {
      const id = element.dataset.flipId;
      if (!id) {
        continue;
      }
      const rect = element.getBoundingClientRect();
      const box = {
        x: rect.left - origin.left + root.scrollLeft,
        y: rect.top - origin.top + root.scrollTop,
      };
      next.set(id, box);
      const before = boxes.current.get(id);
      const dx = before ? before.x - box.x : 0;
      const dy = before ? before.y - box.y : 0;
      if (!still && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
        element.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
          { duration: DURATION, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
        );
      }
    }
    boxes.current = next;
  });
}
