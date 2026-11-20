// Fonctionnalités : les réglages de chaque module (maquette 07-fonctionnalites). Les pages
// Notes, Cours et Tâches les lisent dans le store. Une section n'apparaît que si le module
// est disponible pour le compte en cours.
import {
  ArrowDown,
  Calendar,
  Card as CardIcon,
  Check,
  Clock,
  Coefficient,
  Cutlery,
  Folder,
  Grades,
  Tasks,
  Trash,
} from "@getpapillon/papicons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button/Button";
import { Card } from "@/components/Card/Card";
import { ConfirmDialog } from "@/components/ConfirmDialog/ConfirmDialog";
import { Section } from "@/components/Section/Section";
import { Segmented } from "@/components/Segmented/Segmented";
import { Select } from "@/components/Select/Select";
import { SettingRow } from "@/components/SettingRow/SettingRow";
import { useLoaded } from "@/hooks/useLoaded";
import { downloadsFolder, openDownloadsFolder } from "@/lib/files";
import { log } from "@/lib/log";
import { visibleModules } from "@/modules/registry";
import { accountManager } from "@/services";
import { capabilitiesOf } from "@/services/shared/plugin";
import {
  GRADE_SCALES,
  TASKS_LAYOUTS,
  useSettingsStore,
} from "@/stores/settings";
import { useSyncStore } from "@/stores/sync";

import type { SettingsSectionProps } from "./Settings";
import styles from "./settings.module.scss";
import { SwitchRow } from "./SwitchRow";

export function FeaturesSettings({ account }: SettingsSectionProps) {
  const { t } = useTranslation();
  const gradeScale = useSettingsStore(state => state.gradeScale);
  const tasksLayout = useSettingsStore(state => state.tasksLayout);
  const setPreference = useSettingsStore(state => state.setPreference);
  const capabilities = capabilitiesOf(account?.kinds ?? []);
  const available = new Set(
    visibleModules(capabilities).map(module => module.id)
  );
  const canteen =
    capabilities.has("CANTEEN_MENU") || capabilities.has("CANTEEN_BOOKINGS");

  return (
    <>
      {available.has("notes") && (
        <Section title={t("modules.notes")}>
          <Card rows>
            <SettingRow
              icon={Grades}
              title={t("settings.features.gradeScale")}
              titleId="features-scale"
              text={t("settings.features.gradeScaleText")}
            >
              <Select
                labelledBy="features-scale"
                value={gradeScale}
                options={GRADE_SCALES.map(scale => ({
                  value: scale,
                  label: t("settings.features.outOf", { scale }),
                }))}
                onChange={scale => setPreference("gradeScale", scale)}
              />
            </SettingRow>
            <SwitchRow icon={Coefficient} setting="showCoefficients" />
          </Card>
        </Section>
      )}

      <Section title={t("modules.cours")}>
        <Card rows>
          <SwitchRow icon={Calendar} setting="showWeekend" />
          <SwitchRow icon={Clock} setting="showNowLine" />
          <SwitchRow icon={Cutlery} setting="showBreaks" />
          {canteen && <SwitchRow icon={CardIcon} setting="showCanteen" />}
        </Card>
      </Section>

      {available.has("taches") && (
        <Section title={t("modules.taches")}>
          <Card rows>
            <SettingRow
              icon={Tasks}
              title={t("settings.features.tasksLayout")}
              titleId="features-layout"
              text={t("settings.features.tasksLayoutText")}
            >
              <Segmented
                name="tasksLayout"
                labelledBy="features-layout"
                value={tasksLayout}
                options={TASKS_LAYOUTS.map(layout => ({
                  value: layout,
                  label: t(`settings.features.${layout}`),
                }))}
                onChange={layout => setPreference("tasksLayout", layout)}
              />
            </SettingRow>
            <SwitchRow icon={Check} setting="hideDoneTasks" />
          </Card>
        </Section>
      )}

      {account && <DownloadsSection accountId={account.id} />}
    </>
  );
}

/** Mo à partir de 1 Mo, sinon ko : un PDF de cours pèse rarement plus de quelques Mo. */
function formatSize(bytes: number, language: string) {
  const mega = bytes >= 1_000_000;
  return new Intl.NumberFormat(language, {
    style: "unit",
    unit: mega ? "megabyte" : "kilobyte",
    maximumFractionDigits: 1,
  }).format(bytes / (mega ? 1_000_000 : 1_000));
}

/** Où vont les pièces jointes téléchargées, ce qu'elles pèsent, et le téléchargement des nouvelles. */
function DownloadsSection({ accountId }: { accountId: string }) {
  const { t, i18n } = useTranslation();
  const changed = useSyncStore(state => state.reload);
  const downloads = useSyncStore(state => state.versions.downloads);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const folder = useLoaded(downloadsFolder, String(version));
  const years = useLoaded(
    () => accountManager.downloadsByYear(accountId),
    `${accountId}:${version}:${downloads}`
  );

  const fail = (key: string) => (failure: unknown) => {
    log(
      "warn",
      "fichiers",
      `Dossier des téléchargements : ${typeof failure === "string" ? failure : "?"}`
    );
    setError(key);
  };

  const change = () => {
    setBusy(true);
    setError(null);
    accountManager
      .changeDownloadsFolder(t("settings.features.chooseFolder"))
      .then(chosen => {
        if (chosen) {
          setVersion(count => count + 1);
          changed("downloads");
        }
      }, fail("settings.features.folderRefused"))
      .finally(() => setBusy(false));
  };

  const open = () => {
    setError(null);
    openDownloadsFolder().catch(fail("settings.features.folderUnavailable"));
  };

  const remove = (year: string) => {
    setBusy(true);
    setError(null);
    accountManager
      .deleteDownloads(accountId, year)
      .catch(fail("settings.features.deleteFailed"))
      .finally(() => {
        setBusy(false);
        setDeleting(null);
        changed("downloads");
      });
  };

  return (
    <Section title={t("settings.features.attachments")}>
      <Card rows>
        <SettingRow
          icon={Folder}
          title={t("settings.features.downloadsFolder")}
          text={folder.status === "ready" ? folder.data : undefined}
        >
          <div className={styles.actions}>
            <Button onClick={open}>{t("settings.features.openFolder")}</Button>
            <Button disabled={busy} onClick={change}>
              {t("settings.features.changeFolder")}
            </Button>
          </div>
        </SettingRow>
        <SwitchRow icon={ArrowDown} setting="autoDownload" />
        {years.status === "ready" &&
          years.data.map(({ year, count, size }) => (
            <SettingRow
              key={year}
              icon={Folder}
              title={year}
              text={t("settings.features.yearFiles", {
                count,
                size: formatSize(size, i18n.language),
              })}
            >
              <Button
                variant="danger"
                icon={Trash}
                disabled={busy}
                onClick={() => setDeleting(year)}
              >
                {t("settings.features.deleteYear")}
              </Button>
            </SettingRow>
          ))}
      </Card>
      {error && (
        <p className={styles.error} role="alert">
          {t(error)}
        </p>
      )}
      <ConfirmDialog
        open={deleting !== null}
        danger
        busy={busy}
        title={t("settings.features.deleteYearTitle", { year: deleting })}
        text={t("settings.features.deleteYearText")}
        confirm={t("settings.features.deleteYear")}
        onConfirm={() => deleting && remove(deleting)}
        onCancel={() => setDeleting(null)}
      />
    </Section>
  );
}
