// Actualités (maquette 06-vie-scolaire/01-actualites) : en messagerie, la liste à gauche
// (recherche, non lues en gras) et l'actualité choisie à droite, avec ses pièces jointes.
// L'ouvrir la marque comme lue chez le service.
import { Font, Paper } from "@getpapillon/papicons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Avatar } from "@/components/Avatar/Avatar";
import { Card } from "@/components/Card/Card";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import { Menu } from "@/components/Menu/Menu";
import { Page } from "@/components/Page/Page";
import { SearchField } from "@/components/SearchField/SearchField";
import { Segmented } from "@/components/Segmented/Segmented";
import { useDateFormats } from "@/hooks/useFormats";
import { type NewsView, useNews } from "@/hooks/useNews";
import { log } from "@/lib/log";
import { matches } from "@/lib/search";
import type { ModulePageProps } from "@/modules/registry";
import { accountManager } from "@/services";
import { useAccountStore } from "@/stores/accounts";
import { useSyncStore } from "@/stores/sync";

import styles from "./actualites.module.scss";

type Filter = "all" | "unread";

/** « Mme Leroy » devient un prénom et un nom pour les initiales (« ML »). */
const authorOf = (author: string) => {
  const [firstName = "", ...rest] = author.split(" ");
  return { firstName, lastName: rest.join(" ") };
};

export function ActualitesPage({ module }: ModulePageProps) {
  const { t } = useTranslation();
  const accountId =
    useAccountStore(state => state.currentAccountId) ?? undefined;
  const reload = useSyncStore(state => state.reload);
  const formats = useDateFormats();
  const items = useNews(accountId);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [large, setLarge] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const all = items.status === "ready" ? items.data : [];
  const shown = all.filter(
    item =>
      (filter === "all" || !item.read) &&
      matches(`${item.title ?? ""} ${item.author} ${item.content}`, query)
  );
  const current =
    all.find(item => `${item.serviceId}:${item.id}` === selected) ?? shown[0];

  const open = (item: NewsView) => {
    setSelected(`${item.serviceId}:${item.id}`);
    if (!item.read) {
      accountManager.markNewsRead(item.serviceId, item.id).then(
        () => reload("news"),
        () =>
          // Hors ligne : elle reste non lue, rien à signaler.
          log("warn", "news", "Actualité non marquée comme lue")
      );
    }
  };

  const actions = (
    <>
      <div className={styles.search}>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={t("actualites.search")}
        />
      </div>
      <Segmented
        name="actualites-filter"
        label={t("actualites.filter")}
        value={filter}
        options={[
          { value: "all", label: t("actualites.filters.all") },
          { value: "unread", label: t("actualites.filters.unread") },
        ]}
        onChange={setFilter}
      />
      <Menu
        label={t("actualites.theme")}
        icon={Font}
        items={[
          {
            kind: "option",
            label: t("actualites.themes.normal"),
            checked: !large,
            onSelect: () => setLarge(false),
          },
          {
            kind: "option",
            label: t("actualites.themes.large"),
            checked: large,
            onSelect: () => setLarge(true),
          },
        ]}
      />
    </>
  );

  const body =
    items.status === "loading" ? null : items.status === "error" ? (
      <EmptyState
        icon={module.icon}
        title={t("actualites.error")}
        text={t("errors.database")}
      />
    ) : all.length === 0 ? (
      <Card className={styles.empty}>
        <EmptyState
          icon={module.icon}
          title={t("actualites.empty.title")}
          text={t("actualites.empty.text")}
        />
      </Card>
    ) : (
      <div className={styles.layout}>
        <Card as="ul" className={styles.list}>
          {shown.map(item => {
            const key = `${item.serviceId}:${item.id}`;
            const active = current === item;
            return (
              <li key={key}>
                <button
                  type="button"
                  className={styles.item}
                  data-selected={active || undefined}
                  data-unread={!item.read || undefined}
                  aria-pressed={active}
                  onClick={() => open(item)}
                >
                  <Avatar account={authorOf(item.author)} size={36} />
                  <span className={styles.itemText}>
                    <span className={styles.itemMeta}>
                      <span>{item.author}</span>
                      <span>{formats.shortDate.format(item.date)}</span>
                    </span>
                    <strong>{item.title ?? t("actualites.untitled")}</strong>
                    <span className={styles.excerpt}>{item.content}</span>
                  </span>
                  {item.attachments.length > 0 && (
                    <Paper
                      className={styles.clip}
                      size={14}
                      aria-label={t("actualites.hasAttachments")}
                    />
                  )}
                </button>
              </li>
            );
          })}
          {shown.length === 0 && (
            <li className={styles.noMatch}>{t("actualites.noMatch")}</li>
          )}
        </Card>
        {current && (
          <Card
            as="section"
            className={styles.reader}
            data-large={large || undefined}
            aria-label={current.title ?? t("actualites.untitled")}
          >
            <header className={styles.readerHead}>
              <Avatar account={authorOf(current.author)} size={44} />
              <span>
                <strong>{current.author}</strong>
                <small>
                  {t("actualites.publishedAt", {
                    date: formats.shortDate.format(current.date),
                    time: formats.time.format(current.date),
                  })}
                </small>
              </span>
            </header>
            <h2 className={styles.readerTitle}>
              {current.title ?? t("actualites.untitled")}
            </h2>
            <div className={styles.readerBody}>
              {current.content.split("\n").map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
            {current.attachments.length > 0 && (
              <ul className={styles.attachments}>
                {current.attachments.map(attachment => (
                  <li key={attachment.url}>
                    <span className={styles.fileIcon} aria-hidden="true">
                      <Paper size={18} />
                    </span>
                    <span>
                      <strong>{attachment.name}</strong>
                      <small>{t(`taches.attachment.${attachment.kind}`)}</small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    );

  return (
    <Page title={t("modules.actualites")} actions={actions} flat>
      <div className={styles.page}>{body}</div>
    </Page>
  );
}
