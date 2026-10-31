// Une ligne de réglage avec un interrupteur, branchée sur un réglage du store.
import type { Home } from "@getpapillon/papicons";
import { useTranslation } from "react-i18next";

import { SettingRow } from "@/components/SettingRow/SettingRow";
import { Switch } from "@/components/Switch/Switch";
import { type Toggle, useSettingsStore } from "@/stores/settings";

/** Textes : `settings.toggles.<setting>.title` et `.text`. */
export function SwitchRow({
  icon,
  setting,
}: {
  icon: typeof Home;
  setting: Toggle;
}) {
  const { t } = useTranslation();
  const checked = useSettingsStore(state => state[setting]);
  const setPreference = useSettingsStore(state => state.setPreference);
  return (
    <SettingRow
      as="label"
      icon={icon}
      title={t(`settings.toggles.${setting}.title`)}
      text={t(`settings.toggles.${setting}.text`)}
    >
      <Switch
        checked={checked}
        onChange={value => setPreference(setting, value)}
      />
    </SettingRow>
  );
}
