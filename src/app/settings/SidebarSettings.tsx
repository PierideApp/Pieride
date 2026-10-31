// Barre latérale : afficher, masquer et réordonner les modules de chaque compte
// (docs/modules.md, maquette 08-barre-laterale). Seuls les modules qu'un service du compte
// fournit sont listés. On réordonne en glissant la ligne, ou au clavier avec les flèches
// sur sa poignée ; un module reste dans son groupe.
import { Bell, Lock, Menu } from "@getpapillon/papicons";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/Card/Card";
import { Notice } from "@/components/Notice/Notice";
import { Section } from "@/components/Section/Section";
import { Select } from "@/components/Select/Select";
import { SettingRow } from "@/components/SettingRow/SettingRow";
import { Switch } from "@/components/Switch/Switch";
import { Tip } from "@/components/Tip/Tip";
import { MOD } from "@/lib/platform";
import { modulePath, moveModule, visibleModules } from "@/modules/registry";
import {
  capabilitiesOf,
  SERVICE_CAPABILITIES,
  SERVICE_NAMES,
} from "@/services/shared/plugin";
import { useSettingsStore } from "@/stores/settings";

import type { SettingsSectionProps } from "./Settings";
import styles from "./settings.module.scss";
import { SwitchRow } from "./SwitchRow";

export function SidebarSettings({ account, accounts }: SettingsSectionProps) {
  const { t, i18n } = useTranslation();
  // Le compte réglé : celui affiché, ou un autre choisi dans la liste.
  const [chosenId, setChosenId] = useState(account?.id);
  const chosen =
    accounts.find(candidate => candidate.id === chosenId) ?? account;
  const hidden = useSettingsStore(state =>
    chosen ? state.hiddenModules[chosen.id] : undefined
  );
  const order = useSettingsStore(state =>
    chosen ? state.moduleOrder[chosen.id] : undefined
  );
  const setModuleHidden = useSettingsStore(state => state.setModuleHidden);
  const setModuleOrder = useSettingsStore(state => state.setModuleOrder);
  const dragged = useRef<string | null>(null);
  const handles = useRef(new Map<string, HTMLButtonElement>());
  // Après un déplacement au clavier, le focus reste sur la poignée du module déplacé.
  const [moved, setMoved] = useState<string | null>(null);
  useEffect(() => {
    if (moved) {
      handles.current.get(moved)?.focus();
    }
  }, [moved, order]);

  if (!chosen) {
    return <Notice>{t("settings.modules.noAccount")}</Notice>;
  }
  const capabilities = capabilitiesOf(chosen.kinds);
  const all = visibleModules(capabilities, [], order);
  const shown = visibleModules(capabilities, hidden, order);
  const services = new Intl.ListFormat(i18n.language);
  const move = (id: string, target: string | undefined) => {
    if (target) {
      setModuleOrder(chosen.id, moveModule(all, id, target));
    }
  };
  const onHandleKey = (event: KeyboardEvent, index: number, id: string) => {
    const step = { ArrowUp: -1, ArrowDown: 1 }[event.key];
    if (step) {
      event.preventDefault();
      move(id, all[index + step]?.id);
      setMoved(id);
    }
  };

  return (
    <>
      <Section
        title={t("settings.modules.label")}
        aside={
          accounts.length > 1 ? (
            <div className={styles.accountPicker}>
              <span id="modules-account" className={styles.hint}>
                {t("settings.modules.account")}
              </span>
              <Select
                labelledBy="modules-account"
                value={chosen.id}
                options={accounts.map(candidate => ({
                  value: candidate.id,
                  label: `${candidate.firstName} ${candidate.lastName}`,
                }))}
                onChange={setChosenId}
              />
            </div>
          ) : (
            <span className={styles.hint}>{t("settings.modules.reorder")}</span>
          )
        }
      >
        <Card as="ul" rows>
          {all.map((module, index) => {
            const name = t(`modules.${module.id}`);
            const position = shown.indexOf(module);
            const providers = chosen.kinds
              .filter(kind =>
                SERVICE_CAPABILITIES[kind].some(capability =>
                  module.requires.includes(capability)
                )
              )
              .map(kind => SERVICE_NAMES[kind]);
            return (
              <SettingRow
                key={module.id}
                as="li"
                draggable
                onDragStart={event => {
                  dragged.current = module.id;
                  setMoved(null);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={event => {
                  const from = all.find(({ id }) => id === dragged.current);
                  // Accepter le dépôt seulement dans le même groupe.
                  if (from?.group === module.group) {
                    event.preventDefault();
                  }
                }}
                onDrop={event => {
                  event.preventDefault();
                  if (dragged.current) {
                    move(dragged.current, module.id);
                  }
                }}
                onDragEnd={() => {
                  dragged.current = null;
                }}
                media={
                  <button
                    ref={handle => {
                      if (handle) {
                        handles.current.set(module.id, handle);
                      } else {
                        handles.current.delete(module.id);
                      }
                    }}
                    type="button"
                    className={styles.handle}
                    aria-label={t("settings.modules.move", { name })}
                    title={t("settings.modules.moveHint")}
                    onKeyDown={event => onHandleKey(event, index, module.id)}
                  />
                }
                icon={module.icon}
                title={name}
                text={
                  providers.length === 0
                    ? t("settings.modules.always")
                    : t("settings.modules.providedBy", {
                        services: services.format(new Set(providers)),
                      })
                }
              >
                {position >= 0 && position < 9 && (
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
                  <Switch
                    aria-label={name}
                    checked={position >= 0}
                    onChange={checked =>
                      setModuleHidden(chosen.id, module.id, !checked)
                    }
                  />
                )}
              </SettingRow>
            );
          })}
        </Card>
        <Tip>{t("settings.modules.tip")}</Tip>
      </Section>

      <Section title={t("settings.modules.display")}>
        <Card rows>
          <SwitchRow icon={Menu} setting="sidebarAutoCollapse" />
          <SwitchRow icon={Bell} setting="sidebarBadges" />
        </Card>
      </Section>
    </>
  );
}
