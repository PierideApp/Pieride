// Ouvrir une pièce jointe : un fichier est téléchargé par l'AccountManager puis ouvert avec
// l'app du système ; un lien, déjà confirmé dans `AttachmentList`, part dans le navigateur.
// Pour l'écran : la pièce jointe en cours d'ouverture, et le dernier échec.
import { openUrl } from "@tauri-apps/plugin-opener";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { log } from "@/lib/log";
import { accountManager } from "@/services";
import type { Attachment } from "@/services/shared/models";

/** Les codes de `attachments.rs` qui ont leur propre message ; le reste : `fallback`. */
const ERRORS = new Set(["type_refused", "too_large", "open_failed"]);

/** `serviceId` : le service de la pièce jointe (aucun : rien ne s'ouvre). */
export function useOpenAttachment(serviceId: string | undefined) {
  const { t } = useTranslation();
  const [state, setState] = useState<{ url: string; error?: string } | null>(
    null
  );

  const fail = (
    url: string,
    error: unknown,
    fallback: "download" | "link" = "download"
  ) => {
    const code = typeof error === "string" ? error : undefined;
    // Le code seulement : le message d'un service peut contenir l'adresse du fichier.
    log(
      "warn",
      "fichiers",
      `Pièce jointe non ouverte : ${code ?? (error instanceof Error ? error.name : "?")}`
    );
    setState({
      url,
      error: t(
        `attachmentList.errors.${code && ERRORS.has(code) ? code : fallback}`
      ),
    });
  };

  const open = (attachment: Attachment) => {
    if (attachment.kind === "link") {
      setState(null);
      // Seulement http et https (capabilities/default.json) : ni fichier, ni autre app.
      openUrl(attachment.url).catch((error: unknown) =>
        fail(attachment.url, error, "link")
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

  return {
    open,
    opening: state && !state.error ? state.url : undefined,
    error:
      state?.error === undefined
        ? undefined
        : { url: state.url, message: state.error },
  };
}
