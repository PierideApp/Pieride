// Premier lancement (UX §6), tant qu'il n'y a aucun compte. Fenêtre sans barre latérale :
// à gauche la marque et la progression, à droite l'étape en cours (maquettes 01-premier-lancement).
// On crée un compte PRONOTE ou un compte hors ligne ; les autres services arrivent en M4.
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { WindowControls } from "@/app/layout/WindowControls";
import mark from "@/assets/brand/mark.svg";

import { BackButton } from "./BackButton";
import { OfflineAccountStep } from "./OfflineAccountStep";
import styles from "./onboarding.module.scss";
import { ProfileStep } from "./ProfileStep";
import { PronoteFlow } from "./pronote";
import { ServiceStep } from "./ServiceStep";
import { Welcome } from "./Welcome";

type Step = "welcome" | "profile" | "service" | "offline" | "pronote";

/** Le numéro de chaque étape dans « Étape 1 sur 3 » : la connexion, quelle qu'elle soit, est la troisième. */
const POSITION: Record<Exclude<Step, "welcome">, number> = {
  profile: 1,
  service: 2,
  offline: 3,
  pronote: 3,
};
const TOTAL = 3;

export function Onboarding() {
  const { t } = useTranslation();
  // Le chemin suivi, pour que « Retour » revienne à l'étape d'avant (on peut sauter « Service »).
  const [history, setHistory] = useState<Step[]>(["welcome"]);
  const step = history.at(-1) ?? "welcome";
  const go = (next: Step) => setHistory([...history, next]);
  const back = () => setHistory(history.slice(0, -1));

  if (step === "welcome") {
    return <Welcome onStart={() => go("profile")} />;
  }
  const position = POSITION[step];
  return (
    <div className={styles.onboarding}>
      <aside className={styles.brand} data-tauri-drag-region>
        <img src={mark} alt="" className={styles.mark} />
        <p className={styles.name}>piéride</p>
        <p className={styles.tagline}>{t("onboarding.tagline")}</p>
        <div className={styles.progress}>
          <p>
            {t("onboarding.step", {
              current: position,
              total: TOTAL,
            })}
          </p>
          <div className={styles.bars} aria-hidden="true">
            {Array.from({ length: TOTAL }, (_, index) => (
              <span key={index} data-done={index < position || undefined} />
            ))}
          </div>
        </div>
      </aside>

      <main className={styles.panel}>
        <WindowControls />
        {step !== "pronote" && <BackButton onClick={back} />}
        {step === "profile" && (
          <ProfileStep
            onNext={() => go("service")}
            onOffline={() => go("offline")}
          />
        )}
        {step === "service" && (
          <ServiceStep
            onPronote={() => go("pronote")}
            onOffline={() => go("offline")}
          />
        )}
        {step === "offline" && <OfflineAccountStep onCancel={back} />}
        {/* Une fois connecté, le compte existe : l'app quitte le premier lancement. */}
        {step === "pronote" && <PronoteFlow onExit={back} />}
      </main>
    </div>
  );
}
