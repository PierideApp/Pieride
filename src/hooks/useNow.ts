// L'heure actuelle, remise à jour toutes les 30 secondes : ligne de l'heure dans Cours,
// « encore 33 min » dans le détail d'un cours.
import { useEffect, useState } from "react";

export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
