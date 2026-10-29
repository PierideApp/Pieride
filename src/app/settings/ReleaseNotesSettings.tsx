// Notes de version : les fichiers de `changelog/` (lib/changelog.ts), de la plus récente à la
// plus ancienne. Pour chaque version, son numéro et sa date à gauche, ses notes à droite,
// comme sur le site de StewardPad.
import { Paper } from "@getpapillon/papicons";
import { getVersion } from "@tauri-apps/api/app";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/Card/Card";
import { Chip } from "@/components/Chip/Chip";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import { useLoaded } from "@/hooks/useLoaded";
import { type Block, parseInline, parseNotes, releases } from "@/lib/changelog";
import { useSettingsStore } from "@/stores/settings";

import styles from "./settings.module.scss";

function Inline({ text }: { text: string }) {
  return parseInline(text).map((part, index) =>
    part.kind === "strong" ? (
      <strong key={index}>{part.text}</strong>
    ) : part.kind === "code" ? (
      <code key={index}>{part.text}</code>
    ) : (
      part.text
    )
  );
}

function Notes({ blocks }: { blocks: Block[] }) {
  return blocks.map((block, index) =>
    block.kind === "heading" ? (
      <h4 key={index}>
        <Inline text={block.text} />
      </h4>
    ) : block.kind === "list" ? (
      <ul key={index}>
        {block.items.map((item, itemIndex) => (
          <li key={itemIndex}>
            <Inline text={item} />
          </li>
        ))}
      </ul>
    ) : (
      <p key={index}>
        <Inline text={block.text} />
      </p>
    )
  );
}

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
      <div className={styles.releaseNotes}>
        {title && <h3>{title}</h3>}
        <Notes blocks={parseNotes(body)} />
      </div>
    </article>
  ));
}
