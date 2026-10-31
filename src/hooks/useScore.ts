// Les notes affichées (Notes, Accueil) : deux décimales, ramenées sur l'échelle choisie
// (Paramètres > Fonctionnalités, 20 par défaut).
import { useTranslation } from "react-i18next";

import type { GradeView } from "@/hooks/useGrades";
import { onTwenty } from "@/lib/grades";
import { useSettingsStore } from "@/stores/settings";

export function useScore() {
  const { i18n } = useTranslation();
  const scale = useSettingsStore(state => state.gradeScale);
  const number = new Intl.NumberFormat(i18n.language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const signed = new Intl.NumberFormat(i18n.language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "always",
  });
  return {
    scale,
    /** Une valeur sur 20, sur l'échelle choisie : « 14,89 ». */
    format: (onTwentyValue: number) =>
      number.format((onTwentyValue / 20) * scale),
    /** Un écart sur 20, avec son signe : « +0,42 ». */
    delta: (onTwentyValue: number) =>
      signed.format((onTwentyValue / 20) * scale),
    /** Une note : sa valeur sur l'échelle, ou son statut (« Abs. »). */
    grade: (grade: GradeView) => {
      const value = onTwenty(grade);
      return value === undefined
        ? (grade.status ?? "")
        : number.format((value / 20) * scale);
    },
  };
}
