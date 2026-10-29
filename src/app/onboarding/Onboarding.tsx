// Premier lancement (UX §6), tant qu'il n'y a aucun compte. Fenêtre sans barre latérale :
// à gauche la marque et la progression, à droite l'étape en cours (maquettes 01-premier-lancement).
// Pour l'instant seul le compte hors ligne se crée : la connexion PRONOTE arrive en M3.
import { ChevronLeft } from "@getpapillon/papicons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { WindowControls } from "@/app/layout/WindowControls";
import mark from "@/assets/brand/mark.svg";
import { Button } from "@/components/Button/Button";

import { OfflineAccountStep } from "./OfflineAccountStep";
import styles from "./onboarding.module.scss";
import { ProfileStep } from "./ProfileStep";
import { ServiceStep } from "./ServiceStep";
import { Welcome } from "./Welcome";

type Step = "welcome" | "profile" | "service" | "offline";

/** Les étapes comptées dans « Étape 1 sur 3 ». */
const COUNTED: readonly Step[] = ["profile", "service", "offline"];

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
  const position = COUNTED.indexOf(step) + 1;
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
              total: COUNTED.length,
            })}
          </p>
          <div className={styles.bars} aria-hidden="true">
            {COUNTED.map((id, index) => (
              <span key={id} data-done={index < position || undefined} />
            ))}
          </div>
        </div>
      </aside>

      <main className={styles.panel}>
        <WindowControls />
        <Button
          variant="ghost"
          icon={ChevronLeft}
          className={styles.back}
          onClick={back}
        >
          {t("onboarding.back")}
        </Button>
        {step === "profile" && (
          <ProfileStep
            onNext={() => go("service")}
            onOffline={() => go("offline")}
          />
        )}
        {step === "service" && <ServiceStep onOffline={() => go("offline")} />}
        {step === "offline" && <OfflineAccountStep onCancel={back} />}
      </main>
    </div>
  );
}
