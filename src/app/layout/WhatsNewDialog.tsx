// Les nouveautés après une mise à jour (maquette 02-accueil/04-notes-de-version) : s'ouvre une
// seule fois, au premier lancement d'une version dont `.github/changelog/` a les notes. Une installation
// toute neuve ne l'ouvre pas : elle note la version et c'est tout.
import { Cross } from "@getpapillon/papicons";
import { getVersion } from "@tauri-apps/api/app";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button/Button";
import { ReleaseNotes } from "@/components/ReleaseNotes/ReleaseNotes";
import { useLoaded } from "@/hooks/useLoaded";
import { onOwnClose, useModalDialog } from "@/hooks/useModalDialog";
import { releases } from "@/lib/changelog";
import { useSettingsStore } from "@/stores/settings";

import styles from "./whatsNew.module.scss";

export function WhatsNewDialog() {
  const { t, i18n } = useTranslation();
  const language = useSettingsStore(state => state.language);
  const seen = useSettingsStore(state => state.lastSeenVersion);
  const setSeen = useSettingsStore(state => state.setLastSeenVersion);
  const installed = useLoaded(getVersion, "version");
  const version = installed.status === "ready" ? installed.data : null;
  const release =
    version && seen && seen !== version
      ? releases(language).find(entry => entry.version === version)
      : undefined;
  const dialog = useModalDialog(release !== undefined);

  useEffect(() => {
    // Première installation, ou mise à jour sans notes : rien à montrer.
    if (version && seen !== version && !release) {
      setSeen(version);
    }
  }, [version, seen, release, setSeen]);

  if (!release) {
    return null;
  }
  const close = () => setSeen(release.version);
  const day = new Intl.DateTimeFormat(i18n.language, { dateStyle: "long" });
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="whats-new-title"
      onClose={onOwnClose(close)}
    >
      <header className={styles.header}>
        <div>
          <h2 id="whats-new-title" className={styles.title}>
            {t("whatsNew.title", { version: release.version })}
          </h2>
          <p className={styles.subtitle}>{t("whatsNew.subtitle")}</p>
        </div>
        <button
          type="button"
          className={styles.close}
          aria-label={t("dialog.close")}
          onClick={close}
        >
          <Cross size={16} />
        </button>
      </header>
      <div className={styles.body}>
        <div className={styles.banner}>
          <span className={styles.version}>
            {t("whatsNew.version", { version: release.version })}
          </span>
          <time dateTime={release.date}>
            {t("whatsNew.since", {
              date: day.format(new Date(`${release.date}T12:00`)),
            })}
          </time>
        </div>
        <ReleaseNotes title={release.title} body={release.body} />
      </div>
      <footer className={styles.footer}>
        <Button variant="primary" onClick={close}>
          {t("whatsNew.confirm")}
        </Button>
      </footer>
    </dialog>
  );
}
