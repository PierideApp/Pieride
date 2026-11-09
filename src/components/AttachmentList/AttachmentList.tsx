// Les pièces jointes d'un devoir, d'un cours ou d'une actualité : une ligne par fichier ou lien,
// son icône sur fond rouge pâle, son type (« PDF ») ou son site. En lignes dans une `Card rows`
// (maquette 04-taches/02-tableau-detail), ou en tuiles sous un texte (`tiles`, maquette
// 06-vie-scolaire/01-actualites). Avec `onOpen`, un clic l'ouvre ; un lien demande d'abord
// confirmation, avec son adresse : il peut mener n'importe où.
import { ExternalLink, Link, Paper } from "@getpapillon/papicons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/Card/Card";
import { ConfirmDialog } from "@/components/ConfirmDialog/ConfirmDialog";
import { SettingRow } from "@/components/SettingRow/SettingRow";
import { Spinner } from "@/components/Spinner/Spinner";
import type { Attachment } from "@/services/shared/models";

import styles from "./AttachmentList.module.scss";

/** Le site d'un lien, sans `www.` ; l'adresse entière si elle ne se lit pas. */
const siteOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** L'extension d'un fichier en capitales (« PDF »), s'il en a une. */
const typeOf = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toUpperCase() : undefined;
};

export function AttachmentList({
  attachments,
  variant = "rows",
  onOpen,
  opening,
  error,
}: {
  attachments: readonly Attachment[];
  variant?: "rows" | "tiles";
  /** Ouvre un fichier, ou un lien une fois confirmé. Sans lui, la liste ne fait qu'afficher. */
  onOpen?: (attachment: Attachment) => void;
  /** L'adresse de la pièce jointe en cours d'ouverture. */
  opening?: string;
  /** L'échec de la dernière ouverture, affiché s'il concerne une pièce jointe de la liste. */
  error?: { url: string; message: string };
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState<Attachment | null>(null);
  const open =
    onOpen &&
    ((attachment: Attachment) =>
      attachment.kind === "link"
        ? setConfirming(attachment)
        : onOpen(attachment));
  const detail = (attachment: Attachment) =>
    attachment.kind === "link"
      ? `${t("attachmentList.link")} · ${siteOf(attachment.url)}`
      : (typeOf(attachment.name) ?? t("attachmentList.file"));
  const icon = (attachment: Attachment) => (
    <span className={styles.icon} aria-hidden="true">
      {attachment.kind === "link" ? <Link size={18} /> : <Paper size={18} />}
    </span>
  );
  const end = (attachment: Attachment) =>
    attachment.url === opening ? (
      <Spinner label={t("attachmentList.opening")} />
    ) : (
      open &&
      attachment.kind === "link" && (
        <ExternalLink size={16} className={styles.end} aria-hidden="true" />
      )
    );
  const failed =
    error && attachments.some(attachment => attachment.url === error.url);

  return (
    <>
      {variant === "rows" ? (
        <Card rows>
          {attachments.map(attachment => (
            <SettingRow
              key={attachment.url}
              as={open ? "button" : "div"}
              media={icon(attachment)}
              title={attachment.name}
              text={detail(attachment)}
              disabled={open ? attachment.url === opening : undefined}
              onClick={open && (() => open(attachment))}
            >
              {end(attachment)}
            </SettingRow>
          ))}
        </Card>
      ) : (
        <ul className={styles.tiles}>
          {attachments.map(attachment => (
            <li key={attachment.url}>
              <button
                type="button"
                className={styles.tile}
                disabled={!open || attachment.url === opening}
                onClick={open && (() => open(attachment))}
              >
                {icon(attachment)}
                <span className={styles.tileText}>
                  <strong>{attachment.name}</strong>
                  <small>{detail(attachment)}</small>
                </span>
                {end(attachment)}
              </button>
            </li>
          ))}
        </ul>
      )}
      {failed && (
        <p className={styles.error} role="alert">
          {error.message}
        </p>
      )}
      <ConfirmDialog
        open={confirming !== null}
        title={t("attachmentList.confirmTitle")}
        text={t("attachmentList.confirmText", {
          site: confirming ? siteOf(confirming.url) : "",
        })}
        confirm={t("attachmentList.confirm")}
        onConfirm={() => {
          if (confirming) {
            onOpen?.(confirming);
          }
          setConfirming(null);
        }}
        onCancel={() => setConfirming(null)}
      >
        <p className={styles.address}>{confirming?.url}</p>
      </ConfirmDialog>
    </>
  );
}
