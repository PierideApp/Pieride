// Tâches (maquettes 04-taches) : les devoirs de la semaine en tableau (une colonne par jour) ou
// en liste (par date de rendu), leur progression, et le détail d'un devoir à droite. Les
// flèches ← et → changent de semaine.
import { Ghost, Grid, List } from "@getpapillon/papicons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/Card/Card";
import { DateNav } from "@/components/DateNav/DateNav";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import { Menu } from "@/components/Menu/Menu";
import { Page } from "@/components/Page/Page";
import { SearchField } from "@/components/SearchField/SearchField";
import { Segmented } from "@/components/Segmented/Segmented";
import { SubjectEmoji } from "@/components/SubjectEmoji/SubjectEmoji";
import { useDateFormats } from "@/hooks/useFormats";
import { type HomeworkView, useHomework } from "@/hooks/useHomework";
import { useNow } from "@/hooks/useNow";
import { matches } from "@/lib/search";
import { addDays, displayedToday, isoWeek, weekDays } from "@/lib/week";
import type { ModulePageProps } from "@/modules/registry";
import { useAccountStore } from "@/stores/accounts";
import { useDetailStore } from "@/stores/detail";
import { useSettingsStore } from "@/stores/settings";

import styles from "./taches.module.scss";
import { TaskBoard } from "./TaskBoard";
import { TaskDetail } from "./TaskDetail";
import { TaskList } from "./TaskList";
import { TaskSummary } from "./TaskSummary";
import { useToggleHomework } from "./toggle";

const FILTERS = ["todo", "done", "all"] as const;
type Filter = (typeof FILTERS)[number];
type Sort = "due" | "subject";

/** Une flèche tapée dans un champ ne change pas de semaine. */
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export function TachesPage({ module }: ModulePageProps) {
  const { t } = useTranslation();
  const accountId =
    useAccountStore(state => state.currentAccountId) ?? undefined;
  const weekend = useSettingsStore(state => state.showWeekend);
  const layout = useSettingsStore(state => state.tasksLayout);
  const hideDone = useSettingsStore(state => state.hideDoneTasks);
  const setPreference = useSettingsStore(state => state.setPreference);
  const openDetail = useDetailStore(state => state.open);
  const detailOpen = useDetailStore(state => state.content !== null);
  const formats = useDateFormats();
  const now = useNow();
  const [week, setWeek] = useState(() => displayedToday(now, weekend));
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("due");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const tasks = useHomework(accountId, week);
  const { toggle, error, pending } = useToggleHomework();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.key !== "ArrowLeft" && event.key !== "ArrowRight") ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isTyping(event.target) ||
        document.querySelector("dialog[open]")
      ) {
        return;
      }
      setWeek(current => addDays(current, event.key === "ArrowLeft" ? -7 : 7));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const all = tasks.status === "ready" ? tasks.data : [];
  const shown = all
    .filter(
      item =>
        (filter === "all" || item.done === (filter === "done")) &&
        !(hideDone && item.done) &&
        matches(`${item.label} ${item.content}`, query)
    )
    .sort((a, b) =>
      sort === "subject"
        ? a.label.localeCompare(b.label, formats.locale)
        : a.dueAt.getTime() - b.dueAt.getTime()
    );

  const open = (item: HomeworkView) => {
    setSelected(item.id);
    openDetail({
      title: item.label,
      subtitle: `${t("taches.dueFor", {
        day: formats.relativeDay(item.dueAt, now),
      })} · ${formats.longDate.format(item.dueAt)}`,
      media: <SubjectEmoji emoji={item.emoji} color={item.color} size={48} />,
      body: (
        <TaskDetail
          accountId={accountId}
          dueAt={item.dueAt}
          serviceId={item.serviceId}
          id={item.id}
        />
      ),
    });
  };

  const navigation = (
    <DateNav
      label={t("cours.week")}
      badge={String(isoWeek(week))}
      onPrevious={() => setWeek(addDays(week, -7))}
      onNext={() => setWeek(addDays(week, 7))}
    />
  );
  const actions = (
    <>
      {!detailOpen && (
        <div className={styles.search}>
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={t("taches.search")}
          />
        </div>
      )}
      <Segmented
        name="taches-filter"
        label={t("taches.filter")}
        value={filter}
        options={FILTERS.map(value => ({
          value,
          label: t(`taches.filters.${value}`),
        }))}
        onChange={setFilter}
      />
      <Menu
        label={t("taches.display")}
        icon={layout === "board" ? Grid : List}
        items={[
          { kind: "heading", label: t("taches.layout") },
          {
            kind: "option",
            label: t("settings.features.board"),
            hint: t("taches.boardHint"),
            icon: Grid,
            checked: layout === "board",
            onSelect: () => setPreference("tasksLayout", "board"),
          },
          {
            kind: "option",
            label: t("settings.features.list"),
            hint: t("taches.listHint"),
            icon: List,
            checked: layout === "list",
            onSelect: () => setPreference("tasksLayout", "list"),
          },
          { kind: "separator" },
          { kind: "heading", label: t("taches.sortBy") },
          {
            kind: "option",
            label: t("taches.sort.due"),
            checked: sort === "due",
            onSelect: () => setSort("due"),
          },
          {
            kind: "option",
            label: t("taches.sort.subject"),
            checked: sort === "subject",
            onSelect: () => setSort("subject"),
          },
          { kind: "separator" },
          {
            kind: "option",
            label: t("taches.hideDone"),
            checked: hideDone,
            onSelect: () => setPreference("hideDoneTasks", !hideDone),
          },
        ]}
      />
    </>
  );

  const body =
    tasks.status === "loading" ? null : tasks.status === "error" ? (
      <EmptyState
        icon={module.icon}
        title={t("taches.error")}
        text={t("errors.database")}
      />
    ) : all.length === 0 ? (
      <Card className={styles.emptyWeek}>
        <EmptyState
          icon={Ghost}
          title={t("taches.empty.title", { week: isoWeek(week) })}
          text={t("taches.empty.text")}
        />
        <p className={styles.keys}>
          {t("taches.previousWeek")}
          <kbd className={styles.kbd}>←</kbd>
          <kbd className={styles.kbd}>→</kbd>
          {t("taches.nextWeek")}
        </p>
      </Card>
    ) : (
      <>
        <TaskSummary items={all} now={now} />
        {error && (
          <p className={styles.error} role="alert">
            {t(error)}
          </p>
        )}
        {layout === "board" ? (
          <TaskBoard
            days={weekDays(week, weekend)}
            items={shown}
            now={now}
            selected={detailOpen ? selected : null}
            pending={pending}
            onOpen={open}
            onToggle={item => void toggle(item)}
          />
        ) : (
          <TaskList
            items={shown}
            now={now}
            selected={detailOpen ? selected : null}
            pending={pending}
            onOpen={open}
            onToggle={item => void toggle(item)}
          />
        )}
      </>
    );

  return (
    <Page
      title={t("modules.taches")}
      navigation={navigation}
      actions={actions}
      flat
    >
      <div className={styles.page}>{body}</div>
    </Page>
  );
}
