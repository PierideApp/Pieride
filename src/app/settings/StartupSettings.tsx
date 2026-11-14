// Démarrage et fenêtre (maquette 12-demarrage-et-fenetre) : comment Piéride vit sur
// l'ordinateur. Le lancement à l'ouverture de session est inscrit dans le système (plugin
// autostart, avec `--minimized`) ; le reste est dans le store. Les mises à jour : UpdateRow.
import {
  ArrowDown,
  ArrowDownBox,
  Clock,
  Cross,
  Login,
  Sparkles,
} from "@getpapillon/papicons";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/Card/Card";
import { Section } from "@/components/Section/Section";
import { SettingRow } from "@/components/SettingRow/SettingRow";
import { Switch } from "@/components/Switch/Switch";
import { useLoaded } from "@/hooks/useLoaded";
import { report } from "@/lib/log";
import { MOD } from "@/lib/platform";
import { visibleModules } from "@/modules/registry";
import { capabilitiesOf } from "@/services/shared/plugin";
import { useSettingsStore } from "@/stores/settings";

import type { SettingsSectionProps } from "./Settings";
import styles from "./settings.module.scss";
import { SwitchRow } from "./SwitchRow";
import { UpdateRow } from "./UpdateRow";

// Un code d'erreur du système, jamais une donnée.
const fail = (error: unknown) => report("settings", error);

function Keys({ keys }: { keys: readonly string[] }) {
  return keys.map(key => <kbd key={key}>{key}</kbd>);
}

export function StartupSettings({ account }: SettingsSectionProps) {
  const { t } = useTranslation();
  const autostart = useLoaded(isEnabled, "autostart");
  const autoUpdate = useSettingsStore(state => state.autoUpdate);
  const hidden = useSettingsStore(state =>
    account ? state.hiddenModules[account.id] : undefined
  );
  /** Le choix fait ici, en attendant que le système le confirme à la prochaine lecture. */
  const [launch, setLaunch] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const sections = visibleModules(
    capabilitiesOf(account?.kinds ?? []),
    hidden
  ).length;
  const launchAtLogin =
    launch ?? (autostart.status === "ready" && autostart.data);

  const shortcuts: { id: string; keys: string[]; to?: string }[] = [
    { id: "palette", keys: [MOD, "K"] },
    { id: "sections", keys: [MOD, "1"], to: String(Math.min(sections, 9)) },
    { id: "sync", keys: [MOD, "R"] },
    { id: "settings", keys: [MOD, ","] },
    { id: "close", keys: [t("keys.escape")] },
  ];

  return (
    <>
      <Section title={t("settings.startup.launch")}>
        <Card rows>
          <SettingRow
            as="label"
            icon={Login}
            title={t("settings.startup.atLogin")}
            text={t("settings.startup.atLoginText")}
          >
            <Switch
              checked={launchAtLogin}
              disabled={autostart.status !== "ready"}
              onChange={on => {
                setFailed(false);
                (on ? enable() : disable()).then(
                  () => setLaunch(on),
                  (error: unknown) => {
                    fail(error);
                    setFailed(true);
                  }
                );
              }}
            />
          </SettingRow>
          <SwitchRow icon={ArrowDownBox} setting="startMinimized" />
          <SwitchRow icon={Cross} setting="closeToTray" />
          <SwitchRow icon={Clock} setting="trayGlance" />
        </Card>
        {(failed || autostart.status === "error") && (
          <p className={styles.error} role="alert">
            {t("settings.startup.autostartFailed")}
          </p>
        )}
      </Section>

      <Section title={t("settings.startup.updates")}>
        <Card rows>
          <UpdateRow />
          <SwitchRow icon={Sparkles} setting="autoUpdate" />
          <SwitchRow
            icon={ArrowDown}
            setting="autoInstall"
            disabled={!autoUpdate}
          />
        </Card>
      </Section>

      <Section title={t("settings.startup.shortcuts")}>
        <Card className={styles.shortcuts}>
          <dl>
            {shortcuts.map(({ id, keys, to }) => (
              <div key={id}>
                <dt>{t(`settings.startup.shortcut.${id}`)}</dt>
                <dd>
                  <Keys keys={keys} />
                  {to && (
                    <>
                      {` ${t("settings.startup.to")} `}
                      <kbd>{to}</kbd>
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </Section>
    </>
  );
}
