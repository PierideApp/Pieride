// Accueil (maquette 02-accueil) : un bandeau avec le fond d'écran choisi, le bonjour et le
// résumé du jour, une rangée de cartes d'une ligne (les widgets à leur plus petite taille, comme
// les raccourcis de la maquette), puis la grille des widgets plus grands. « Modifier l'accueil »
// les déplace, change leur taille, les retire ou les remet ; le bouton image ouvre le choix du
// fond d'écran.
import { Gallery, Ghost, Grid } from "@getpapillon/papicons";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";

import { Button } from "@/components/Button/Button";
import { Card } from "@/components/Card/Card";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import { useAccounts } from "@/hooks/useAccounts";
import { useAttendance } from "@/hooks/useAttendance";
import { useFlip } from "@/hooks/useFlip";
import { capitalize, useDateFormats } from "@/hooks/useFormats";
import { currentPeriod, gradesOf, useGrades } from "@/hooks/useGrades";
import { useHomework } from "@/hooks/useHomework";
import { useNews } from "@/hooks/useNews";
import { useNow } from "@/hooks/useNow";
import { useTimetable } from "@/hooks/useTimetable";
import { sameDay, shiftDay, startOfDay } from "@/lib/week";
import { useToggleHomework } from "@/modules/taches/toggle";
import { capabilitiesOf, type Capability } from "@/services/shared/plugin";
import { useAccountStore } from "@/stores/accounts";
import {
  DEFAULT_HOME_LAYOUT,
  type HomeItem,
  type HomeWidget,
  useSettingsStore,
  type WidgetSize,
} from "@/stores/settings";
import { useSettingsDialog } from "@/stores/settingsDialog";
import {
  useWallpaperStore,
  wallpaperBackground,
  wallpaperShade,
} from "@/stores/wallpaper";

import styles from "./accueil.module.scss";
import {
  DragCopy,
  EditBar,
  StripHint,
  UndoToast,
  useHomeEditor,
  WidgetSlot,
} from "./HomeEditor";
import { type Drop, dropItem, isMini, levelOf, resizeItem } from "./layout";
import {
  AttendanceWidget,
  AverageWidget,
  CoursesWidget,
  GradesWidget,
  NewsWidget,
  TasksWidget,
  WidgetWaiting,
} from "./Widgets";

/** Temps laissé pour annuler le retrait d'un widget. */
const UNDO_DELAY = 6000;

/** Hauteur des boutons de la fenêtre en haut de la page (layout.module.scss, `.controls`). */
const CONTROLS_HEIGHT = 40;

/** Ce qu'un service du compte doit fournir pour qu'un widget ait du sens. */
const REQUIRES: Record<HomeWidget, Capability> = {
  attendance: "ATTENDANCE",
  news: "NEWS",
  courses: "TIMETABLE",
  average: "GRADES",
  tasks: "HOMEWORK",
  grades: "GRADES",
};

export function AccueilPage() {
  const { t } = useTranslation();
  const accountId =
    useAccountStore(state => state.currentAccountId) ?? undefined;
  const weekend = useSettingsStore(state => state.showWeekend);
  const layout = useSettingsStore(state => state.homeLayout);
  const setPreference = useSettingsStore(state => state.setPreference);
  const showSettings = useSettingsDialog(state => state.show);
  const { pathname } = useLocation();
  const wallpaper = useWallpaperStore();
  const formats = useDateFormats();
  const now = useNow();
  const accounts = useAccounts();
  const account =
    accounts.status === "ready"
      ? accounts.data.find(candidate => candidate.id === accountId)
      : undefined;
  const [editing, setEditing] = useState(false);

  const today = startOfDay(now);
  const nextDay = shiftDay(today, 1, weekend);
  const week = useTimetable(accountId, today);
  const nextWeek = useTimetable(accountId, nextDay);
  const homework = useHomework(accountId, today);
  const grades = useGrades(accountId);
  const news = useNews(accountId);
  const attendance = useAttendance(accountId);
  const { toggle, error, pending } = useToggleHomework();

  const capabilities = capabilitiesOf(account?.kinds ?? []);
  const provided = (id: HomeWidget) => capabilities.has(REQUIRES[id]);

  const pageRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLElement>(null);
  // Le bandeau sous les boutons de la fenêtre : ils passent en blanc (layout.module.scss).
  const [underControls, setUnderControls] = useState(true);
  const stripRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  // L'accueil d'avant la modification (« Annuler »), et le dernier widget retiré.
  const [snapshot, setSnapshot] = useState<HomeItem[] | null>(null);
  const [removed, setRemoved] = useState<{
    item: HomeItem;
    index: number;
  } | null>(null);
  const commit = (next: HomeItem[]) => setPreference("homeLayout", next);
  const editor = useHomeEditor({
    layout,
    strip: stripRef,
    grid: gridRef,
    copy: copyRef,
    onCommit: commit,
  });
  // Les widgets ne bougent qu'en modification.
  useFlip(pageRef, editing);

  // Les widgets que les services du compte peuvent remplir, avec le geste en cours appliqué :
  // les cartes d'une ligne en haut, les autres dans la grille.
  const shown = editor.preview.filter(item => provided(item.id));
  const zones = [
    shown.filter(item => isMini(item.size)),
    shown.filter(item => !isMini(item.size)),
  ] as const;

  const moveWidget = (id: HomeWidget, drop: Drop) =>
    commit(dropItem(layout, id, drop));
  const resizeWidget = (id: HomeWidget, size: WidgetSize) =>
    commit(resizeItem(layout, id, size));
  const removeWidget = (id: HomeWidget) => {
    const index = layout.findIndex(item => item.id === id);
    const item = layout[index];
    if (item) {
      setRemoved({ item, index });
      commit(layout.filter(other => other.id !== id));
    }
  };
  const startEditing = () => {
    setSnapshot(layout);
    setEditing(true);
  };
  const stopEditing = () => {
    setEditing(false);
    setRemoved(null);
  };

  useEffect(() => {
    const root = pageRef.current;
    const banner = bannerRef.current;
    if (!root || !banner) {
      return;
    }
    // Vrai tant que le bas du bandeau est sous les boutons, faux une fois la page défilée.
    const observer = new IntersectionObserver(
      ([entry]) => setUnderControls(entry?.isIntersecting ?? false),
      { root, rootMargin: `-${CONTROLS_HEIGHT}px 0px 0px 0px` }
    );
    observer.observe(banner);
    return () => observer.disconnect();
  }, []);

  // Le bandeau « Annuler » d'un retrait reste quelques secondes.
  useEffect(() => {
    if (!removed) {
      return;
    }
    const timer = setTimeout(() => setRemoved(null), UNDO_DELAY);
    return () => clearTimeout(timer);
  }, [removed]);

  // Échap termine la modification.
  useEffect(() => {
    if (!editing) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) {
        setEditing(false);
        setRemoved(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editing]);

  const remaining =
    week.status === "ready"
      ? week.data.filter(
          course => sameDay(course.from, today) && course.to > now
        )
      : [];
  const held = remaining.filter(course => course.status !== "canceled");
  const nextCourses =
    nextWeek.status === "ready"
      ? nextWeek.data.filter(course => sameDay(course.from, nextDay))
      : [];
  const tasks =
    homework.status === "ready"
      ? homework.data.filter(item => item.dueAt >= today)
      : [];
  const allGrades = grades.status === "ready" ? grades.data.grades : [];
  const period =
    grades.status === "ready"
      ? currentPeriod(grades.data.periods, allGrades, now)
      : undefined;
  const periodGrades = gradesOf(allGrades, period);
  const absences = (
    attendance.status === "ready" ? attendance.data : []
  ).filter(
    item => !period || (item.from >= period.start && item.from <= period.end)
  );
  const background = wallpaperBackground(wallpaper);
  const newsItems = news.status === "ready" ? news.data : [];
  /** Le widget n'a rien à montrer, mais ses données sont en route. */
  const waiting: Record<HomeWidget, boolean> = {
    attendance: attendance.fetching && absences.length === 0,
    news: news.fetching && newsItems.length === 0,
    courses:
      (week.fetching || nextWeek.fetching) &&
      remaining.length === 0 &&
      nextCourses.length === 0,
    average: grades.fetching && periodGrades.length === 0,
    tasks: homework.fetching && tasks.length === 0,
    grades: grades.fetching && periodGrades.length === 0,
  };

  const widget = (id: HomeWidget, size: WidgetSize): ReactNode => {
    const level = levelOf(size);
    switch (id) {
      case "attendance":
        return <AttendanceWidget level={level} items={absences} now={now} />;
      case "news":
        return <NewsWidget level={level} items={newsItems} />;
      case "courses":
        return (
          <CoursesWidget
            level={level}
            remaining={remaining}
            nextDay={nextDay}
            nextCourses={nextCourses}
            now={now}
          />
        );
      case "average":
        return (
          <AverageWidget level={level} grades={periodGrades} period={period} />
        );
      case "tasks":
        return (
          <TasksWidget
            level={level}
            items={tasks}
            now={now}
            pending={pending}
            onToggle={item => void toggle(item)}
          />
        );
      case "grades":
        return <GradesWidget level={level} grades={periodGrades} now={now} />;
      default:
        return id satisfies never;
    }
  };

  /** Un emplacement de widget, avec ses voisins de zone pour les flèches du clavier. */
  const slot =
    (zone: readonly HomeItem[]) => (item: HomeItem, index: number) => (
      <WidgetSlot
        key={item.id}
        id={item.id}
        name={t(`accueil.widgets.${item.id}`)}
        size={item.size}
        before={zone[index - 1]?.id}
        after={zone[index + 1]?.id}
        editing={editing}
        editor={editor}
        onMove={moveWidget}
        onResize={resizeWidget}
        onRemove={removeWidget}
      >
        <WidgetWaiting value={waiting[item.id]}>
          {widget(item.id, item.size)}
        </WidgetWaiting>
      </WidgetSlot>
    );

  const addable = DEFAULT_HOME_LAYOUT.filter(
    item => provided(item.id) && !layout.some(other => other.id === item.id)
  ).map(item => ({
    kind: "option" as const,
    label: t(`accueil.widgets.${item.id}`),
    onSelect: () => commit([...layout, { ...item }]),
  }));
  const dragged =
    editor.drag && layout.find(item => item.id === editor.drag?.id);

  return (
    <div
      ref={pageRef}
      className={styles.page}
      data-editing={editing || undefined}
      data-gesture={editor.drag ? true : undefined}
      data-window-banner={underControls || undefined}
    >
      <header ref={bannerRef} className={styles.banner} data-tauri-drag-region>
        <div
          className={styles.wallpaper}
          data-brand={background ? undefined : true}
          style={background ? { background } : undefined}
        >
          {/* Assombrit un fond clair derrière le texte blanc (stores/wallpaper.ts). */}
          <span
            className={styles.scrim}
            style={{ "--shade": wallpaperShade(wallpaper) }}
          />
        </div>
        <div className={styles.bannerActions}>
          <Button
            variant="onBrand"
            className={styles.glassIcon}
            icon={Gallery}
            aria-label={t("accueil.wallpaper")}
            title={t("accueil.wallpaper")}
            onClick={() =>
              showSettings(pathname, { section: "appearance", wallpaper: true })
            }
          />
          <Button
            variant="onBrand"
            className={styles.glass}
            icon={Grid}
            aria-pressed={editing}
            onClick={editing ? stopEditing : startEditing}
          >
            {t("accueil.edit")}
          </Button>
        </div>
        <h1 className={styles.hello} data-tauri-drag-region>
          {account
            ? t("accueil.hello", { name: account.firstName })
            : t("accueil.helloAnonymous")}
        </h1>
        <p className={styles.summary} data-tauri-drag-region>
          {capitalize(formats.longDate.format(now), formats.locale)} ·{" "}
          {held.length > 0
            ? t("accueil.coursesLeft", { count: held.length })
            : t("accueil.noMoreCourses")}
        </p>
      </header>
      {(zones[0].length > 0 || editing) && (
        <div
          ref={stripRef}
          className={styles.strip}
          data-drop={
            editor.drag?.drop?.kind === "end" &&
            editor.drag.drop.zone === "strip"
              ? true
              : undefined
          }
        >
          {zones[0].map(slot(zones[0]))}
          {editing && zones[0].length === 0 && <StripHint />}
        </div>
      )}
      <div className={styles.dashboard} ref={gridRef}>
        {shown.length === 0 ? (
          <Card className={styles.empty}>
            <EmptyState
              icon={Ghost}
              title={t("accueil.empty.title")}
              text={t("accueil.empty.text")}
              action={
                editing
                  ? undefined
                  : {
                      label: t("accueil.addWidget"),
                      onClick: startEditing,
                    }
              }
            />
          </Card>
        ) : (
          zones[1].map(slot(zones[1]))
        )}
        {error && (
          <p className={styles.error} role="alert">
            {t(error)}
          </p>
        )}
      </div>
      {dragged && editor.drag && (
        <DragCopy drag={editor.drag} ref={copyRef}>
          {widget(dragged.id, dragged.size)}
        </DragCopy>
      )}
      {editing && removed && (
        <UndoToast
          name={t(`accueil.widgets.${removed.item.id}`)}
          onUndo={() => {
            const next = [...layout];
            next.splice(removed.index, 0, removed.item);
            commit(next);
            setRemoved(null);
          }}
        />
      )}
      {editing && (
        <EditBar
          addable={addable}
          onCancel={() => {
            if (snapshot) {
              commit(snapshot);
            }
            stopEditing();
          }}
          onReset={() => commit([...DEFAULT_HOME_LAYOUT])}
          onDone={stopEditing}
        />
      )}
    </div>
  );
}
