// Connexion à PRONOTE, du choix de la méthode à la première synchro. Sert au premier
// lancement, à l'ajout d'un compte et à la reconnexion (Paramètres > Comptes liés).
import { useState } from "react";

import type { InstanceInfo, School } from "@/services/pronote/login";

import { BackButton } from "../BackButton";
import { CityStep } from "./CityStep";
import { ConnectStep, type Relink } from "./ConnectStep";
import { MethodStep } from "./MethodStep";
import { UrlStep } from "./UrlStep";

type Step =
  | { id: "method" }
  | { id: "city" }
  | { id: "url" }
  | { id: "connect"; school: School | InstanceInfo };

export function PronoteFlow({
  relink,
  onExit,
  onDone,
}: {
  relink?: Relink;
  /** « Retour » depuis la première étape. */
  onExit: () => void;
  onDone?: () => void;
}) {
  const [history, setHistory] = useState<Step[]>([
    relink ? { id: "connect", school: relink } : { id: "method" },
  ]);
  const step = history[history.length - 1];
  const go = (next: Step) => setHistory([...history, next]);
  const back = () =>
    history.length > 1 ? setHistory(history.slice(0, -1)) : onExit();

  return (
    <>
      {/* L'étape de connexion a le sien : il disparaît pendant la synchro. */}
      {step.id !== "connect" && <BackButton onClick={back} />}
      {step.id === "method" && (
        <MethodStep onNext={method => go({ id: method })} />
      )}
      {step.id === "city" && (
        <CityStep onNext={school => go({ id: "connect", school })} />
      )}
      {step.id === "url" && (
        <UrlStep onNext={school => go({ id: "connect", school })} />
      )}
      {step.id === "connect" && (
        <ConnectStep
          school={step.school}
          relink={relink}
          onBack={back}
          onDone={onDone}
        />
      )}
    </>
  );
}
