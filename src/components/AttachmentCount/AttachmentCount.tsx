// Le nombre de pièces jointes d'un devoir ou d'un cours, sur sa carte : l'icône des pièces jointes
// (celle d'`AttachmentList`) et le chiffre. Rien quand il n'y en a pas.
import { Paper } from "@getpapillon/papicons";
import { useTranslation } from "react-i18next";

import styles from "./AttachmentCount.module.scss";

export function AttachmentCount({
  count,
  size = 14,
}: {
  count: number;
  size?: number;
}) {
  const { t } = useTranslation();
  if (count === 0) {
    return null;
  }
  const label = t("attachmentCount", { count });
  return (
    <span className={styles.count} role="img" aria-label={label} title={label}>
      <Paper size={size} aria-hidden="true" />
      {count}
    </span>
  );
}
