// Les pièces jointes d'un devoir ou d'un cours (maquette 04-taches/02-tableau-detail) : une
// ligne par fichier ou lien, son icône sur fond rouge pâle, dans une `Card rows`.
import { Paper } from "@getpapillon/papicons";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/Card/Card";
import { SettingRow } from "@/components/SettingRow/SettingRow";
import type { Attachment } from "@/services/shared/models";

import styles from "./AttachmentList.module.scss";

export function AttachmentList({
  attachments,
}: {
  attachments: readonly Attachment[];
}) {
  const { t } = useTranslation();
  return (
    <Card rows>
      {attachments.map(attachment => (
        <SettingRow
          key={attachment.url}
          media={
            <span className={styles.icon} aria-hidden="true">
              <Paper size={18} />
            </span>
          }
          title={attachment.name}
          text={t(`attachmentList.${attachment.kind}`)}
        />
      ))}
    </Card>
  );
}
