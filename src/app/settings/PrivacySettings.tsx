// Vie privée (maquette 11-vie-privee) : Piéride n'envoie aucune statistique. Le choix de
// télémétrie de la maquette attend une décision de l'équipe (« Décisions à prendre ») :
// d'ici là, la page dit simplement ce qui se passe, et rien n'est envoyé.
import {
  Check,
  ExternalLink,
  Ghost,
  Lock,
  Trash,
  User,
} from "@getpapillon/papicons";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button/Button";
import { Card } from "@/components/Card/Card";
import { Section } from "@/components/Section/Section";
import { SettingRow } from "@/components/SettingRow/SettingRow";
import { openLink } from "@/lib/links";

import styles from "./settings.module.scss";

const PROMISES = [
  { id: "local", icon: Lock },
  { id: "keyring", icon: User },
  { id: "services", icon: Check },
  { id: "remove", icon: Trash },
] as const;

export function PrivacySettings() {
  const { t } = useTranslation();
  return (
    <>
      <Card as="section" className={styles.privacy}>
        <SettingRow
          icon={Ghost}
          title={t("settings.privacy.nothing")}
          text={t("settings.privacy.nothingText")}
        />
      </Card>

      <Section title={t("settings.privacy.promises")}>
        <Card as="ul" rows>
          {PROMISES.map(({ id, icon }) => (
            <SettingRow
              key={id}
              as="li"
              icon={icon}
              tone="success"
              title={t(`settings.privacy.${id}`)}
            />
          ))}
        </Card>
      </Section>

      <Button
        trailingIcon={ExternalLink}
        onClick={() =>
          openLink("repository").catch((error: unknown) => {
            // eslint-disable-next-line no-console
            console.error(error);
          })
        }
      >
        {t("settings.privacy.source")}
      </Button>
    </>
  );
}
