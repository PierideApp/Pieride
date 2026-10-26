// Barre latérale : afficher ou masquer chaque module, pour le compte en cours (docs/modules.md).
// Seuls les modules qu'un service du compte fournit sont listés.
import { Lock } from "@getpapillon/papicons";
import { useTranslation } from "react-i18next";

import { MOD } from "@/lib/platform";
import { modulePath, visibleModules } from "@/modules/registry";
import {
  capabilitiesOf,
  SERVICE_CAPABILITIES,
  SERVICE_NAMES,
} from "@/services/shared/plugin";
import { useSettingsStore } from "@/stores/settings";

import type { SettingsSectionProps } from "./Settings";
import styles from "./settings.module.scss";

export function SidebarSettings({ account }: SettingsSectionProps) {
  const { t, i18n } = useTranslation();
  const hidden = useSettingsStore(state =>
    account ? state.hiddenModules[account.id] : undefined
  );
  const setModuleHidden = useSettingsStore(state => state.setModuleHidden);

  if (!account) {
    return <p className={styles.notice}>{t("settings.modules.noAccount")}</p>;
  }
  const capabilities = capabilitiesOf(account.kinds);
  const shown = visibleModules(capabilities, hidden);
  const services = new Intl.ListFormat(i18n.language);

  return (
    <section className={styles.block} aria-labelledby="settings-modules">
      <div className={styles.labelRow}>
        <h3 id="settings-modules" className={styles.label}>
          {t("settings.modules.label")}
        </h3>
        <span className={styles.hint}>
          {t("settings.modules.account", {
            name: `${account.firstName} ${account.lastName}`,
          })}
        </span>
      </div>
      <ul className={styles.card}>
        {visibleModules(capabilities).map(module => {
          const name = t(`modules.${module.id}`);
          const position = shown.indexOf(module);
          const providers = account.kinds
            .filter(kind =>
              SERVICE_CAPABILITIES[kind].some(capability =>
                module.requires.includes(capability)
              )
            )
            .map(kind => SERVICE_NAMES[kind]);
          return (
            <li key={module.id} className={styles.row}>
              <span className={styles.rowIcon} aria-hidden="true">
                <module.icon size={18} />
              </span>
              <span className={styles.rowText}>
                <strong>{name}</strong>
                <small>
                  {providers.length === 0
                    ? t("settings.modules.always")
                    : t("settings.modules.providedBy", {
                        services: services.format(new Set(providers)),
                      })}
                </small>
              </span>
              {position >= 0 && (
                <span className={styles.hint}>
                  {MOD} {position + 1}
                </span>
              )}
              {/* L'accueil est la page d'ouverture : il reste toujours affiché. */}
              {modulePath(module) === "/" ? (
                <span
                  className={styles.locked}
                  title={t("settings.modules.locked")}
                >
                  <Lock size={16} aria-label={t("settings.modules.locked")} />
                </span>
              ) : (
                <input
                  type="checkbox"
                  role="switch"
                  className={styles.switch}
                  aria-label={name}
                  checked={position >= 0}
                  onChange={event =>
                    setModuleHidden(
                      account.id,
                      module.id,
                      !event.target.checked
                    )
                  }
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
