// Ouvrir, télécharger ou montrer dans l'explorateur une pièce jointe, par l'AccountManager. Un
// lien, déjà confirmé dans `AttachmentList`, part dans le navigateur.
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useLoaded } from "@/hooks/useLoaded";
import type { SavedFile } from "@/lib/files";
import { log } from "@/lib/log";
import { accountManager } from "@/services";
import type { Placement } from "@/services/account-manager";
import type { Attachment } from "@/services/shared/models";
import { useSyncStore } from "@/stores/sync";

/** Les codes de `attachments.rs` qui ont leur propre message ; le reste : `download`. */
const ERRORS = new Set([
  "type_refused",
  "too_large",
  "open_failed",
  "write_failed",
]);

const NONE: ReadonlyMap<string, SavedFile> = new Map();

/**
 * `serviceId` : le service des pièces jointes (aucun : rien ne s'ouvre). `placement` : où les
 * télécharger, sous le dossier du compte.
 */
export function useOpenAttachment(
  serviceId: string | undefined,
  attachments: readonly Attachment[],
  placement: Placement
) {
  const { t } = useTranslation();
  const downloads = useSyncStore(state => state.versions.downloads);
  const changed = useSyncStore(state => state.reload);
  const [state, setState] = useState<{
    url: string;
    saving?: boolean;
    error?: string;
  } | null>(null);
  const [version, setVersion] = useState(0);
  // Au retour dans l'app : le fichier a pu être déplacé depuis l'explorateur.
  useEffect(() => {
    const reload = () => setVersion(count => count + 1);
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, []);
  const saved = useLoaded(
    async () =>
      serviceId
        ? accountManager.savedAttachments(serviceId, attachments)
        : NONE,
    // Le tableau est refait à chaque rendu : les adresses disent quand il change vraiment.
    [serviceId, version, downloads, ...attachments.map(item => item.url)].join(
      "\n"
    )
  );

  const fail = (url: string, error: unknown, message?: string) => {
    const code = typeof error === "string" ? error : undefined;
    // Le code seulement : le message d'un service peut contenir l'adresse du fichier.
    log(
      "warn",
      "fichiers",
      `Pièce jointe en échec : ${code ?? (error instanceof Error ? error.name : "?")}`
    );
    setState({
      url,
      error:
        message ??
        t(
          `attachmentList.errors.${code && ERRORS.has(code) ? code : "download"}`
        ),
    });
  };

  const open = (attachment: Attachment) => {
    if (attachment.kind === "link") {
      setState(null);
      // Seulement http et https (capabilities/default.json) : ni fichier, ni autre app.
      openUrl(attachment.url).catch((error: unknown) =>
        fail(attachment.url, error, t("attachmentList.errors.link"))
      );
      return;
    }
    if (!serviceId) {
      return;
    }
    setState({ url: attachment.url });
    accountManager.openAttachment(serviceId, attachment).then(
      () => setState(null),
      (error: unknown) => fail(attachment.url, error)
    );
  };

  const save = (attachment: Attachment) => {
    if (!serviceId) {
      return;
    }
    setState({ url: attachment.url, saving: true });
    accountManager.saveAttachment(serviceId, attachment, placement).then(
      () => {
        setState(null);
        changed("downloads");
      },
      (error: unknown) => fail(attachment.url, error)
    );
  };

  const reveal = (attachment: Attachment) => {
    if (!serviceId) {
      return;
    }
    setState(null);
    accountManager
      .revealAttachment(serviceId, attachment)
      .catch((error: unknown) => {
        fail(attachment.url, error, t("attachmentList.errors.reveal"));
        setVersion(count => count + 1);
      });
  };

  const busy = state && !state.error ? state : undefined;
  // Les props d'`AttachmentList`, à lui passer telles quelles.
  return {
    onOpen: open,
    onSave: save,
    onReveal: reveal,
    opening: busy && !busy.saving ? busy.url : undefined,
    saving: busy?.saving ? busy.url : undefined,
    saved: saved.status === "ready" ? saved.data : NONE,
    error:
      state?.error === undefined
        ? undefined
        : { url: state.url, message: state.error },
  };
}
