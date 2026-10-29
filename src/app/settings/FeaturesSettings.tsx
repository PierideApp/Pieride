// Fonctionnalités : les réglages de chaque module (maquette 07-fonctionnalites). Les pages
// Notes, Cours et Tâches les lisent dans le store. Une section n'apparaît que si le module
// est disponible pour le compte en cours.
import {
  Calendar,
  Card as CardIcon,
  Check,
  Clock,
  Coefficient,
  Cutlery,
  Grades,
  Tasks,
} from "@getpapillon/papicons";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/Card/Card";
import { Section } from "@/components/Section/Section";
import { Segmented } from "@/components/Segmented/Segmented";
import { Select } from "@/components/Select/Select";
import { SettingRow } from "@/components/SettingRow/SettingRow";
import { visibleModules } from "@/modules/registry";
import { capabilitiesOf } from "@/services/shared/plugin";
import {
  GRADE_SCALES,
  TASKS_LAYOUTS,
  useSettingsStore,
} from "@/stores/settings";

import type { SettingsSectionProps } from "./Settings";
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
    </>
  );
}
