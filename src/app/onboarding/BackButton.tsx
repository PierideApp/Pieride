// « Retour » en haut d'une étape du premier lancement.
import { ChevronLeft } from "@getpapillon/papicons";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button/Button";

import styles from "./onboarding.module.scss";

export function BackButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <Button
      variant="ghost"
      icon={ChevronLeft}
      className={styles.back}
      onClick={onClick}
    >
      {t("onboarding.back")}
    </Button>
  );
}
