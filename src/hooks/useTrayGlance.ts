// Met à jour le coup d'œil de la barre des tâches pour le compte affiché : chaque minute,
// après chaque synchronisation, et quand le réglage ou la langue changent.
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { glanceCourses } from "@/app/glance";
import { setTrayGlance } from "@/app/tray";
import { useSettingsStore } from "@/stores/settings";
import { useSyncStore } from "@/stores/sync";

export function useTrayGlance(accountId: string | undefined) {
  const { t, i18n } = useTranslation();
  const enabled = useSettingsStore(state => state.trayGlance);
  const version = useSyncStore(state => state.version);

  useEffect(() => {
    if (!enabled || !accountId) {
      void setTrayGlance(null);
      return;
    }
    let active = true;
    const time = new Intl.DateTimeFormat(i18n.language, { timeStyle: "short" });
    const update = async () => {
      const { current, next } = await glanceCourses(accountId);
      if (!active) {
        return;
      }
      await setTrayGlance([
        current
          ? t("tray.now", {
              subject: current.subject,
              end: time.format(current.to),
            })
          : t("tray.noCurrent"),
        next
          ? t(next.room ? "tray.nextRoom" : "tray.next", {
              subject: next.subject,
              start: time.format(next.from),
              room: next.room,
            })
          : t("tray.noNext"),
      ]);
    };
    const report = (error: unknown) => {
      // Un code d'erreur de la base ou du menu, jamais une donnée.
      // eslint-disable-next-line no-console
      console.error(error);
    };
    update().catch(report);
    const timer = setInterval(() => update().catch(report), 60_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [enabled, accountId, version, t, i18n.language]);
}
