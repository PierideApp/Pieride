// Les pièces jointes d'un devoir, d'un cours ou d'une actualité : une ligne par fichier ou lien,
// son icône sur fond rouge pâle, son type (« PDF ») ou son site. En lignes dans une `Card rows`
// (maquette 04-taches/02-tableau-detail), ou en tuiles sous un texte (`tiles`, maquette
// 06-vie-scolaire/01-actualites). Avec `onOpen`, un clic l'ouvre ; un lien demande d'abord
// confirmation, avec son adresse : il peut mener n'importe où. Avec `onSave`, un bouton à côté
// de chaque fichier le télécharge ; dessous, le dossier où il est rangé.
import {
  AlertTriangle,
  ArrowDown,
  ExternalLink,
  Folder,
  Link,
  Paper,
} from "@getpapillon/papicons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/Card/Card";
import { ConfirmDialog } from "@/components/ConfirmDialog/ConfirmDialog";
import { SettingRow } from "@/components/SettingRow/SettingRow";
import { Spinner } from "@/components/Spinner/Spinner";
import type { SavedFile } from "@/lib/files";
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
  onSave,
  onReveal,
  saving,
  saved,
  error,
}: {
  attachments: readonly Attachment[];
  variant?: "rows" | "tiles";
  /** Ouvre un fichier, ou un lien une fois confirmé. Sans lui, la liste ne fait qu'afficher. */
  onOpen?: (attachment: Attachment) => void;
  /** L'adresse de la pièce jointe en cours d'ouverture. */
  opening?: string;
  onSave?: (attachment: Attachment) => void;
  onReveal?: (attachment: Attachment) => void;
  saving?: string;
  /** Les fichiers téléchargés, par adresse. */
  saved?: ReadonlyMap<string, SavedFile>;
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
  const detail = (attachment: Attachment) => {
    if (attachment.kind === "link") {
      return `${t("attachmentList.link")} · ${siteOf(attachment.url)}`;
    }
    const type = typeOf(attachment.name) ?? t("attachmentList.file");
    const file = saved?.get(attachment.url);
    if (!file) {
      return type;
    }
    return (
      <span title={file.location}>
        {type} ·{" "}
        {file.location
          ? t("attachmentList.savedIn", { folder: file.folders.join(" › ") })
          : t("attachmentList.missing")}
      </span>
    );
  };
  const icon = (attachment: Attachment) => {
    const file = saved?.get(attachment.url);
    const missing = file !== undefined && !file.location;
    return (
      <span
        className={styles.icon}
        data-missing={missing || undefined}
        aria-hidden="true"
      >
        {attachment.kind === "link" ? <Link size={18} /> : <Paper size={18} />}
        {missing && (
          <span className={styles.warning}>
            <AlertTriangle size={12} />
          </span>
        )}
      </span>
    );
  };
  const end = (attachment: Attachment) =>
    attachment.url === opening ? (
      <Spinner label={t("attachmentList.opening")} />
    ) : (
      open &&
      attachment.kind === "link" && (
        <ExternalLink size={16} className={styles.end} aria-hidden="true" />
      )
    );
  // À côté du fichier, pas dedans : un bouton ne peut pas en contenir un autre.
  const action = (attachment: Attachment) => {
    if (attachment.kind !== "file" || !onSave) {
      return null;
    }
    if (attachment.url === saving) {
      return (
        <span className={styles.action}>
          <Spinner label={t("attachmentList.saving")} />
        </span>
      );
    }
    const file = saved?.get(attachment.url);
    const isSaved = file?.location !== undefined;
    const label = t(
      isSaved
        ? "attachmentList.reveal"
        : file
          ? "attachmentList.saveAgain"
          : "attachmentList.save"
    );
    return (
      <button
        type="button"
        className={styles.action}
        aria-label={label}
        title={label}
        disabled={attachment.url === opening}
        onClick={() => (isSaved ? onReveal?.(attachment) : onSave(attachment))}
      >
        {isSaved ? <Folder size={16} /> : <ArrowDown size={16} />}
      </button>
    );
  };
  const failed =
    error && attachments.some(attachment => attachment.url === error.url);

  return (
    <>
      {variant === "rows" ? (
        <Card rows>
          {attachments.map(attachment => (
            <div key={attachment.url} className={styles.line}>
              <SettingRow
                as={open ? "button" : "div"}
                className={styles.row}
                media={icon(attachment)}
                title={attachment.name}
                text={detail(attachment)}
                disabled={open ? attachment.url === opening : undefined}
                onClick={open && (() => open(attachment))}
              >
                {end(attachment)}
              </SettingRow>
              {action(attachment)}
            </div>
          ))}
        </Card>
      ) : (
        <ul className={styles.tiles}>
          {attachments.map(attachment => (
            <li key={attachment.url} className={styles.line}>
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
              {action(attachment)}
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
