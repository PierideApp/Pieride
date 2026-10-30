// Démarrage et fenêtre (maquette 12-demarrage-et-fenetre) : comment Piéride vit sur
// l'ordinateur. Le lancement à l'ouverture de session est inscrit dans le système (plugin
// autostart, avec `--minimized`) ; le reste est dans le store. Les mises à jour automatiques
// arrivent en M6 : en attendant, un lien vers les versions publiées.
import {
  ArrowDownBox,
  Clock,
  Cross,
  ExternalLink,
  Login,
} from "@getpapillon/papicons";
import { getVersion } from "@tauri-apps/api/app";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import icon from "@/assets/brand/icon.svg";
import { Button } from "@/components/Button/Button";
import { Card } from "@/components/Card/Card";
import { Section } from "@/components/Section/Section";
import { SettingRow } from "@/components/SettingRow/SettingRow";
import { Switch } from "@/components/Switch/Switch";
import { useLoaded } from "@/hooks/useLoaded";
import { openLink } from "@/lib/links";
import { report } from "@/lib/log";
import { MOD } from "@/lib/platform";
import { visibleModules } from "@/modules/registry";
import { capabilitiesOf } from "@/services/shared/plugin";
import { useSettingsStore } from "@/stores/settings";

import type { SettingsSectionProps } from "./Settings";
import styles from "./settings.module.scss";
import { SwitchRow } from "./SwitchRow";

// Un code d'erreur du système, jamais une donnée.
const fail = (error: unknown) => report("settings", error);

function Keys({ keys }: { keys: readonly string[] }) {
  return keys.map(key => <kbd key={key}>{key}</kbd>);
}

export function StartupSettings({ account }: SettingsSectionProps) {
  const { t } = useTranslation();
  const autostart = useLoaded(isEnabled, "autostart");
  const version = useLoaded(getVersion, "version");
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
        <Card>
          <SettingRow
            media={
              <img
                src={icon}
                alt=""
                width={44}
                height={44}
                className={styles.appIcon}
              />
            }
            title={t("settings.startup.version", {
              version: version.status === "ready" ? version.data : "",
            })}
            text={t("settings.startup.updatesText")}
          >
            <Button
              trailingIcon={ExternalLink}
              onClick={() => openLink("releases").catch(fail)}
            >
              {t("settings.startup.releases")}
            </Button>
          </SettingRow>
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
