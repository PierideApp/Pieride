// Aller à un élément depuis la palette de commandes : elle ouvre la page du module avec
// l'élément visé dans l'état de la navigation. La page se cale dessus (semaine, période,
// filtres) puis l'ouvre dès qu'elle l'a lu dans la base.
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";

export interface Jump {
  serviceId: string;
  id: string;
  /** Sa date en millisecondes : Cours et Tâches vont à sa semaine. */
  at: number;
  /** La période d'une note. */
  periodId?: string;
}

/** L'état de navigation qui vise `jump`. */
export const jumpTo = (jump: Jump) => ({ jump });

/** L'élément visé par l'état de la navigation, s'il a la bonne forme. */
export function jumpOf(state: unknown): Jump | undefined {
  const jump =
    typeof state === "object" && state !== null && "jump" in state
      ? state.jump
      : undefined;
  if (
    typeof jump !== "object" ||
    jump === null ||
    !("serviceId" in jump && typeof jump.serviceId === "string") ||
    !("id" in jump && typeof jump.id === "string") ||
    !("at" in jump && typeof jump.at === "number")
  ) {
    return undefined;
  }
  const periodId =
    "periodId" in jump && typeof jump.periodId === "string"
      ? jump.periodId
      : undefined;
  return { serviceId: jump.serviceId, id: jump.id, at: jump.at, periodId };
}

/**
 * L'élément visé sur cette page. `aim` règle la page dès qu'il est demandé (pendant le rendu,
 * sans `setState` dans un effet), `open` l'ouvre dès qu'il est dans `items`. Si la lecture
 * se termine (`settled`) sans lui, la demande est oubliée.
 */
export function useJump<T extends { serviceId: string; id: string }>(
  items: readonly T[],
  settled: boolean,
  { aim, open }: { aim: (jump: Jump) => void; open: (item: T) => void }
) {
  const { pathname, state } = useLocation();
  const navigate = useNavigate();
  const jump = useMemo(() => jumpOf(state), [state]);
  const [aimed, setAimed] = useState<Jump>();
  if (jump && jump !== aimed) {
    setAimed(jump);
    aim(jump);
  }
  useEffect(() => {
    if (!jump) {
      return;
    }
    const item = items.find(
      candidate =>
        candidate.serviceId === jump.serviceId && candidate.id === jump.id
    );
    if (item) {
      open(item);
    }
    if (item || settled) {
      // Vidé : la page ne rouvre pas l'élément à son prochain rendu.
      void navigate(pathname, { replace: true });
    }
  }, [jump, items, settled]);
}
