// Textes de dates et de durées des écrans (Cours, Tâches…), dans la langue choisie.
import { useTranslation } from "react-i18next";

import { startOfDay } from "@/lib/week";

/** Première lettre en majuscule : « jeudi » devient « Jeudi ». */
export function capitalize(text: string, locale: string): string {
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

/** Heures manquées, comme les maquettes d'Assiduité : « 12 min », « 3 h 00 ». */
export const hoursMinutes = (minutes: number) =>
  minutes < 60
    ? `${minutes} min`
    : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;

/** Une durée en minutes : « 45 min », « 1 heure », « 1 h 30 ». */
export function useFormatDuration() {
  const { t } = useTranslation();
  return (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const rest = Math.round(minutes % 60);
    if (hours === 0) {
      return t("cours.minutes", { count: rest });
    }
    if (rest === 0) {
      return t("cours.hours", { count: hours });
    }
    return t("cours.hoursMinutes", {
      hours,
      minutes: String(rest).padStart(2, "0"),
    });
  };
}

/** Les formats d'heure et de date de la langue choisie. */
export function useDateFormats() {
  const { i18n } = useTranslation();
  const locale = i18n.language;
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" });
  return {
    locale,
    time: new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
    }),
    weekday,
    shortWeekday: new Intl.DateTimeFormat(locale, { weekday: "short" }),
    shortDate: new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
    }),
    longDate: new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
    /** « aujourd'hui », « demain », « hier », sinon le jour (« lundi »). */
    relativeDay: (date: Date, now: Date) => {
      const days = Math.round(
        (startOfDay(date).getTime() - startOfDay(now).getTime()) / 86_400_000
      );
      return Math.abs(days) <= 1
        ? relative.format(days, "day")
        : weekday.format(date);
    },
  };
}
