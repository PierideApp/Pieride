// Notes de version : les fichiers de `.github/changelog/` (lib/changelog.ts), de la plus récente à la
// plus ancienne. Pour chaque version, son numéro et sa date à gauche, ses notes à droite,
// comme sur le site de StewardPad.
import { Paper } from "@getpapillon/papicons";
import { getVersion } from "@tauri-apps/api/app";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/Card/Card";
import { Chip } from "@/components/Chip/Chip";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import { ReleaseNotes } from "@/components/ReleaseNotes/ReleaseNotes";
import { useLoaded } from "@/hooks/useLoaded";
import { releases } from "@/lib/changelog";
import { useSettingsStore } from "@/stores/settings";

import styles from "./settings.module.scss";

export function ReleaseNotesSettings() {
  const { t, i18n } = useTranslation();
  const language = useSettingsStore(state => state.language);
  const installed = useLoaded(getVersion, "version");
  const day = new Intl.DateTimeFormat(i18n.language, { dateStyle: "long" });
  const list = releases(language);

  if (list.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Paper}
          title={t("settings.releaseNotes.emptyTitle")}
          text={t("settings.releaseNotes.emptyText")}
        />
      </Card>
    );
  }
  return list.map(({ version, date, title, body }) => (
    <article key={version} className={styles.release} id={`v${version}`}>
      <div className={styles.releaseMeta}>
        <span className={styles.releaseVersion}>v{version}</span>
        <time dateTime={date}>{day.format(new Date(`${date}T12:00`))}</time>
        {installed.status === "ready" && installed.data === version && (
          <Chip>{t("settings.releaseNotes.installed")}</Chip>
        )}
      </div>
      <ReleaseNotes title={title} body={body} />
    </article>
  ));
}
