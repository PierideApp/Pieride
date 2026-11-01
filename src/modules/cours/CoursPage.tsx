// Cours (maquettes 03-cours) : l'emploi du temps de la semaine ou d'un jour, et le détail
// d'un cours dans le panneau de droite. Une autre semaine que celle de la synchro est demandée
// au service à la première visite (hooks/useWeekData).
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { DateNav } from "@/components/DateNav/DateNav";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import { Page } from "@/components/Page/Page";
import { Segmented } from "@/components/Segmented/Segmented";
import { Spinner } from "@/components/Spinner/Spinner";
import { SubjectEmoji } from "@/components/SubjectEmoji/SubjectEmoji";
import { capitalize, useDateFormats } from "@/hooks/useFormats";
import { useJump } from "@/hooks/useJump";
import { useNow } from "@/hooks/useNow";
import { type CourseView, useTimetable } from "@/hooks/useTimetable";
import {
  addDays,
  displayedToday,
  isoWeek,
  shiftDay,
  weekDays,
} from "@/lib/week";
import type { ModulePageProps } from "@/modules/registry";
import { useAccountStore } from "@/stores/accounts";
import { type DetailContent, useDetailStore } from "@/stores/detail";
import { useSettingsStore } from "@/stores/settings";

import { CourseDetail } from "./CourseDetail";
import { DayView } from "./DayView";
import { WeekView } from "./WeekView";

type View = "week" | "day";

export function CoursPage({ module }: ModulePageProps) {
  const { t } = useTranslation();
  const accountId =
    useAccountStore(state => state.currentAccountId) ?? undefined;
  const weekend = useSettingsStore(state => state.showWeekend);
  const openDetail = useDetailStore(state => state.open);
  const detailOpen = useDetailStore(state => state.content !== null);
  const formats = useDateFormats();
  const now = useNow();
  const home = displayedToday(now, weekend);
  const [view, setView] = useState<View>("week");
  const [date, setDate] = useState(home);
  const [selected, setSelected] = useState<string | null>(null);
  const timetable = useTimetable(accountId, date);

  const week = view === "week";
  const detailOf = (course: CourseView): DetailContent => ({
    title: course.label,
    subtitle: `${capitalize(formats.longDate.format(course.from), formats.locale)} · ${t(
      "cours.time",
      {
        from: formats.time.format(course.from),
        to: formats.time.format(course.to),
      }
    )}`,
    media: <SubjectEmoji emoji={course.emoji} color={course.color} size={48} />,
    body: <CourseDetail accountId={accountId} course={course} />,
  });
  const open = (course: CourseView) => {
    setSelected(course.id);
    openDetail(detailOf(course));
  };
  // Un cours choisi dans la palette : son jour, dans la vue en cours.
  useJump(
    timetable.status === "ready" ? timetable.data : [],
    !timetable.fetching,
    {
      aim: jump => {
        setDate(new Date(jump.at));
        setSelected(jump.id);
      },
      open: course => openDetail(detailOf(course)),
    }
  );

  const navigation = (
    <DateNav
      label={
        week
          ? t("cours.week")
          : capitalize(formats.weekday.format(date), formats.locale)
      }
      badge={week ? String(isoWeek(date)) : formats.shortDate.format(date)}
      onPrevious={() =>
        setDate(week ? addDays(date, -7) : shiftDay(date, -1, weekend))
      }
      onNext={() =>
        setDate(week ? addDays(date, 7) : shiftDay(date, 1, weekend))
      }
      onToday={() => setDate(home)}
    />
  );
  const actions = (
    <Segmented
      name="cours-view"
      label={t("cours.view")}
      value={view}
      options={[
        { value: "day", label: t("cours.day") },
        { value: "week", label: t("cours.week") },
      ]}
      onChange={setView}
    />
  );

  return (
    <Page
      title={t("modules.cours")}
      navigation={navigation}
      actions={actions}
      flat
    >
      {timetable.status === "error" ? (
        <EmptyState
          icon={module.icon}
          title={t("cours.error")}
          text={t("errors.database")}
        />
      ) : timetable.status === "loading" ? (
        <Spinner size="large" label={t("app.loading")} fill />
      ) : week ? (
        <WeekView
          days={weekDays(date, weekend)}
          courses={timetable.data}
          waiting={timetable.fetching && timetable.data.length === 0}
          now={now}
          selected={detailOpen ? selected : null}
          onOpen={open}
          onPickDay={day => {
            setDate(day);
            setView("day");
          }}
        />
      ) : (
        <DayView
          accountId={accountId}
          day={date}
          courses={timetable.data}
          waiting={timetable.fetching && timetable.data.length === 0}
          now={now}
          selected={detailOpen ? selected : null}
          icon={module.icon}
          onOpen={open}
          onPickDay={setDate}
        />
      )}
    </Page>
  );
}
