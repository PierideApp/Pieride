// Notifications (maquette 10-notifications) : un essai tout de suite, et ce dont l'élève veut
// être averti. Les envois automatiques arrivent avec la synchronisation en arrière-plan (M5),
// qui lira ces réglages : ils sont déjà enregistrés.
import {
  Bell,
  Calendar,
  Clock,
  Grades,
  Newspaper,
  Sunrise,
  Tasks,
  VolumeNo,
} from "@getpapillon/papicons";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import icon from "@/assets/brand/icon.svg";
import { Button } from "@/components/Button/Button";
import { Card } from "@/components/Card/Card";
import { Section } from "@/components/Section/Section";
import { Select } from "@/components/Select/Select";
import { SettingRow } from "@/components/SettingRow/SettingRow";
import { Tip } from "@/components/Tip/Tip";
import { isMac } from "@/lib/platform";
import { REMINDER_TIMES, useSettingsStore } from "@/stores/settings";

import styles from "./settings.module.scss";
import { SwitchRow } from "./SwitchRow";

/** Demande l'autorisation au système si besoin ; faux si l'élève l'a refusée. */
async function allowed(): Promise<boolean> {
  return (
    (await isPermissionGranted()) || (await requestPermission()) === "granted"
  );
}

export function NotificationsSettings() {
  const { t } = useTranslation();
  const homework = useSettingsStore(state => state.notifyHomework);
  const reminder = useSettingsStore(state => state.homeworkReminderTime);
  const setPreference = useSettingsStore(state => state.setPreference);
  /** Clé i18n du résultat du dernier essai. */
  const [problem, setProblem] = useState<string | null>(null);

  const test = async () => {
    setProblem(null);
    try {
      if (!(await allowed())) {
        setProblem("settings.notifications.denied");
        return;
      }
      sendNotification({
        title: "Piéride",
        body: t("settings.notifications.example"),
      });
    } catch (error) {
      // Un code d'erreur du système, jamais une donnée.
      // eslint-disable-next-line no-console
      console.error(error);
      setProblem("settings.notifications.failed");
    }
  };

  return (
    <>
      <div className={styles.notificationSample}>
        <img
          src={icon}
          alt=""
          width={44}
          height={44}
          className={styles.appIcon}
        />
        <span className={styles.sampleText}>
          <small>{t("settings.notifications.sampleFrom")}</small>
          <strong>{t("settings.notifications.example")}</strong>
        </span>
        <Button variant="onBrand" icon={Bell} onClick={() => void test()}>
          {t("settings.notifications.test")}
        </Button>
      </div>
      {problem && (
        <p className={styles.error} role="alert">
          {t(problem)}
        </p>
      )}
      {import.meta.env.DEV && isMac && (
        // En dev, le plugin envoie la notification au nom du Terminal (com.apple.Terminal).
        <Tip>{t("settings.notifications.macDev")}</Tip>
      )}

      <Section title={t("settings.notifications.for")}>
        <Card rows>
          <SwitchRow icon={Grades} setting="notifyGrades" />
          <SwitchRow icon={Calendar} setting="notifyCourses" />
          <SwitchRow icon={Tasks} setting="notifyHomework" />
          {homework && (
            <SettingRow
              icon={Clock}
              title={t("settings.notifications.reminderTime")}
              titleId="notify-reminder"
            >
              <Select
                labelledBy="notify-reminder"
                value={reminder}
                options={REMINDER_TIMES.map(time => ({
                  value: time,
                  label: time,
                }))}
                onChange={time => setPreference("homeworkReminderTime", time)}
              />
            </SettingRow>
          )}
          <SwitchRow icon={Newspaper} setting="notifyNews" />
          <SwitchRow icon={Sunrise} setting="notifyMorning" />
        </Card>
      </Section>

      <Section title={t("settings.notifications.quiet")}>
        <Card rows>
          <SwitchRow icon={VolumeNo} setting="quietDuringClasses" />
        </Card>
        <Tip>{t("settings.notifications.soon")}</Tip>
      </Section>
    </>
  );
}
