// Actualités (maquette 06-vie-scolaire/01-actualites) : en messagerie, la liste à gauche
// (recherche, non lues en gras) et l'actualité choisie à droite, avec ses pièces jointes.
// L'ouvrir la marque comme lue chez le service. L'accusé de réception, lui, ne part que sur
// le bouton « J'en ai pris connaissance » : c'est une déclaration faite à l'établissement.
import { Font, Paper } from "@getpapillon/papicons";
import { createElement, type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { AttachmentList } from "@/components/AttachmentList/AttachmentList";
import { Avatar } from "@/components/Avatar/Avatar";
import { Button } from "@/components/Button/Button";
import { Card } from "@/components/Card/Card";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import { InfoCard } from "@/components/InfoCard/InfoCard";
import { Menu } from "@/components/Menu/Menu";
import { Page } from "@/components/Page/Page";
import { SearchField } from "@/components/SearchField/SearchField";
import { Segmented } from "@/components/Segmented/Segmented";
import { Spinner } from "@/components/Spinner/Spinner";
import { Tip } from "@/components/Tip/Tip";
import { useDateFormats } from "@/hooks/useFormats";
import { useJump } from "@/hooks/useJump";
import { type NewsView, useNews } from "@/hooks/useNews";
import { useOpenAttachment } from "@/hooks/useOpenAttachment";
import { log } from "@/lib/log";
import { matches } from "@/lib/search";
import type { ModulePageProps } from "@/modules/registry";
import { accountManager } from "@/services";
import { SERVICE_NAMES } from "@/services/shared/plugin";
import { useAccountStore } from "@/stores/accounts";
import { useSyncStore } from "@/stores/sync";

import styles from "./actualites.module.scss";

type Filter = "all" | "unread";

/** « Mme Leroy » devient un prénom et un nom pour les initiales (« ML »). */
const authorOf = (author: string) => {
  const [firstName = "", ...rest] = author.split(" ");
  return { firstName, lastName: rest.join(" ") };
};

const titleOf = (item: NewsView, untitled: string) =>
  item.title?.trim() ||
  item.content
    .split(/\r?\n/)
    .find(line => line.trim())
    ?.trim() ||
  untitled;

type NewsNode =
  | { type: "text"; value: string }
  | { type: "image"; src: string; alt: string }
  | { type: "element"; tag: SafeNewsTag; children: NewsNode[] };

type SafeNewsTag =
  | "p"
  | "div"
  | "span"
  | "br"
  | "strong"
  | "b"
  | "em"
  | "i"
  | "u"
  | "s"
  | "ul"
  | "ol"
  | "li"
  | "blockquote"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "table"
  | "thead"
  | "tbody"
  | "tfoot"
  | "tr"
  | "td"
  | "th";

const SAFE_NEWS_TAGS = new Set<SafeNewsTag>([
  "p",
  "div",
  "span",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
]);

const DROP_NEWS_TAGS = new Set([
  "audio",
  "button",
  "embed",
  "form",
  "iframe",
  "input",
  "math",
  "object",
  "script",
  "style",
  "svg",
  "template",
  "video",
]);

function safeImageSource(source: string): string | undefined {
  if (
    /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z\d+/]+=*$/i.test(
      source
    )
  ) {
    return source;
  }
  return undefined;
}

function newsNodes(parent: ParentNode): NewsNode[] {
  return Array.from(parent.childNodes).flatMap(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent ?? "";
      return value ? [{ type: "text" as const, value }] : [];
    }
    if (!(node instanceof Element)) {
      return [];
    }
    const tag = node.tagName.toLowerCase();
    if (DROP_NEWS_TAGS.has(tag)) {
      return [];
    }
    if (tag === "img") {
      const src = safeImageSource(node.getAttribute("src") ?? "");
      return src
        ? [
            {
              type: "image" as const,
              src,
              alt: node.getAttribute("alt") ?? "",
            },
          ]
        : [];
    }
    const children = newsNodes(node);
    return SAFE_NEWS_TAGS.has(tag as SafeNewsTag)
      ? [{ type: "element" as const, tag: tag as SafeNewsTag, children }]
      : children;
  });
}

function renderNewsNode(node: NewsNode, key: number): ReactNode {
  if (node.type === "text") {
    return node.value;
  }
  if (node.type === "image") {
    return (
      <img
        key={key}
        src={node.src}
        alt={node.alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
    );
  }
  if (node.tag === "br") {
    return <br key={key} />;
  }
  return createElement(
    node.tag,
    { key },
    ...node.children.map((child, index) => renderNewsNode(child, index))
  );
}

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
  // L'accusé de réception en cours d'envoi, ou refusé, et l'actualité qu'il concerne.
  const [acknowledgement, setAcknowledgement] = useState<{
    key: string;
    status: "sending" | "failed";
  } | null>(null);

  const all = items.status === "ready" ? items.data : [];
  const shown = all.filter(
    item =>
      (filter === "all" || !item.read) &&
      matches(`${item.title ?? ""} ${item.author} ${item.content}`, query)
  );
  const current =
    all.find(item => `${item.serviceId}:${item.id}` === selected) ?? shown[0];
  const bodyNodes = (() => {
    if (!current?.htmlContent) {
      return [];
    }
    const { body } = new DOMParser().parseFromString(
      current.htmlContent,
      "text/html"
    );
    return newsNodes(body);
  })();
  const attachments = useOpenAttachment(current?.serviceId);
  const ackStatus =
    current && acknowledgement?.key === `${current.serviceId}:${current.id}`
      ? acknowledgement.status
      : undefined;

  const markRead = (item: NewsView) => {
    if (!item.read) {
      accountManager.markNewsRead(item.serviceId, item.id).then(
        () => reload("news"),
        () =>
          // Hors ligne : elle reste non lue, rien à signaler.
          log("warn", "news", "Actualité non marquée comme lue")
      );
    }
  };
  const open = (item: NewsView) => {
    setSelected(`${item.serviceId}:${item.id}`);
    markRead(item);
  };
  const acknowledge = (item: NewsView) => {
    const key = `${item.serviceId}:${item.id}`;
    setAcknowledgement({ key, status: "sending" });
    accountManager.acknowledgeNews(item.serviceId, item.id).then(
      () => {
        setAcknowledgement(null);
        reload("news");
      },
      () => {
        log("warn", "news", "Accusé de réception non envoyé");
        setAcknowledgement({ key, status: "failed" });
      }
    );
  };
  // Une actualité choisie dans la palette : affichée, même lue, et marquée comme lue.
  useJump(all, !items.fetching, {
    aim: jump => {
      setFilter("all");
      setQuery("");
      setSelected(`${jump.serviceId}:${jump.id}`);
    },
    open: markRead,
  });

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
    items.status === "error" ? (
      <EmptyState
        icon={module.icon}
        title={t("actualites.error")}
        text={t("errors.database")}
      />
    ) : items.fetching && all.length === 0 ? (
      <Spinner size="large" label={t("app.loading")} fill />
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
                    <strong>{titleOf(item, t("actualites.untitled"))}</strong>
                    {item.title && item.content && (
                      <span className={styles.excerpt}>{item.content}</span>
                    )}
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
            aria-label={titleOf(current, t("actualites.untitled"))}
          >
            <header className={styles.readerHead}>
              <Avatar account={authorOf(current.author)} size={44} />
              <span>
                <strong>{current.author}</strong>
                <small>
                  {[
                    current.category,
                    t("actualites.publishedAt", {
                      date: formats.shortDate.format(current.date),
                      time: formats.time.format(current.date),
                    }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </span>
            </header>
            <h2 className={styles.readerTitle}>
              {current.title ?? t("actualites.untitled")}
            </h2>
            {current.kind === "survey" && (
              <div className={styles.survey}>
                <Tip>
                  {t("actualites.survey", {
                    service: SERVICE_NAMES[current.service],
                  })}
                </Tip>
              </div>
            )}
            <div className={styles.readerBody}>
              {bodyNodes.length > 0 ? (
                bodyNodes.map((node, index) =>
                  node.type === "text" ? (
                    <p key={index}>{node.value}</p>
                  ) : (
                    renderNewsNode(node, index)
                  )
                )
              ) : (
                <p className={styles.noContent}>{t("actualites.noContent")}</p>
              )}
            </div>
            {current.attachments.length > 0 && (
              <AttachmentList
                variant="tiles"
                attachments={current.attachments}
                onOpen={attachments.open}
                opening={attachments.opening}
                error={attachments.error}
              />
            )}
            {current.needsAcknowledgement && (
              <div className={styles.acknowledgement}>
                {current.acknowledged ? (
                  <InfoCard
                    type="success"
                    title={t("actualites.acknowledgement.done")}
                  >
                    <p>{t("actualites.acknowledgement.doneText")}</p>
                  </InfoCard>
                ) : (
                  <InfoCard title={t("actualites.acknowledgement.title")}>
                    <p>
                      {ackStatus === "failed"
                        ? t("actualites.acknowledgement.failed")
                        : t("actualites.acknowledgement.text")}
                    </p>
                    <Button
                      variant="primary"
                      disabled={ackStatus === "sending"}
                      onClick={() => acknowledge(current)}
                    >
                      {t("actualites.acknowledgement.action")}
                    </Button>
                  </InfoCard>
                )}
              </div>
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
