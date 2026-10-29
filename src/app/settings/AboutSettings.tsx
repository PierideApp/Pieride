// À propos (maquette 14-a-propos) : la version, le système, les liens du projet et les
// licences. Seuls les liens GitHub existent pour l'instant (pas encore de Discord ni de
// Crowdin) ; ils s'ouvrent dans le navigateur (lib/links.ts).
import {
  AlertTriangle,
  Butterfly,
  Code,
  ExternalLink,
  Globe,
  type Home,
  Info,
  Paper,
  User,
} from "@getpapillon/papicons";
import { getTauriVersion, getVersion } from "@tauri-apps/api/app";
import { version as reactVersion } from "react";
import { useTranslation } from "react-i18next";

import mark from "@/assets/brand/mark.svg";
import { Button } from "@/components/Button/Button";
import { Card } from "@/components/Card/Card";
import { SettingRow } from "@/components/SettingRow/SettingRow";
import { useLoaded } from "@/hooks/useLoaded";
import { LINKS, openLink } from "@/lib/links";
import { platformName } from "@/lib/platform";

import styles from "./settings.module.scss";

const CARDS: readonly { link: keyof typeof LINKS; icon: typeof Home }[] = [
  { link: "repository", icon: Code },
  { link: "contributors", icon: User },
  { link: "issues", icon: AlertTriangle },
  { link: "translate", icon: Globe },
  { link: "papillon", icon: Butterfly },
];

const report = (error: unknown) => {
  // Un code d'erreur du système, jamais une donnée.
  // eslint-disable-next-line no-console
  console.error(error);
};

export function AboutSettings() {
  const { t } = useTranslation();
  const app = useLoaded(getVersion, "version");
  const tauri = useLoaded(getTauriVersion, "tauri-version");
  const version = app.status === "ready" ? app.data : "";

  return (
    <>
      <section className={styles.about}>
        <img src={mark} alt="" className={styles.aboutMark} />
        <div>
          <p className={styles.aboutName}>piéride</p>
          <p className={styles.aboutVersion}>
            {t("settings.about.versionOn", {
              version,
              system: platformName,
            })}
          </p>
          <p>{t("settings.about.text")}</p>
        </div>
      </section>

      <ul className={styles.links}>
        {CARDS.map(({ link, icon }) => (
          <li key={link}>
            <SettingRow
              as="button"
              className={styles.linkCard}
              icon={icon}
              title={t(`settings.about.links.${link}.title`)}
              text={t(`settings.about.links.${link}.text`)}
              onClick={() => openLink(link).catch(report)}
            >
              <ExternalLink size={16} aria-hidden="true" />
            </SettingRow>
          </li>
        ))}
      </ul>

      <Card rows>
        <SettingRow
          icon={Info}
          title={t("settings.about.appVersion")}
          value={version}
        />
        <SettingRow
          icon={Code}
          title={t("settings.about.dependencies")}
          value={`${tauri.status === "ready" ? `Tauri ${tauri.data} · ` : ""}React ${reactVersion}`}
        />
        <SettingRow
          icon={Paper}
          title={t("settings.about.licenses")}
          text={t("settings.about.licensesText")}
        >
          <Button
            trailingIcon={ExternalLink}
            onClick={() => openLink("license").catch(report)}
          >
            {t("settings.about.readLicense")}
          </Button>
        </SettingRow>
      </Card>
    </>
  );
}
