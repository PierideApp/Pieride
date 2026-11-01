// Notes (maquettes 05-notes) : pour la période choisie, la moyenne générale et sa courbe, les
// nouvelles notes et une carte par matière ; ou toutes les notes dans un tableau. Le détail
// d'une note ou d'une matière s'ouvre à droite.
import { Filter, Grid } from "@getpapillon/papicons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/Card/Card";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import { Menu } from "@/components/Menu/Menu";
import { Page } from "@/components/Page/Page";
import { SearchField } from "@/components/SearchField/SearchField";
import { Segmented } from "@/components/Segmented/Segmented";
import { Spinner } from "@/components/Spinner/Spinner";
import { SubjectEmoji } from "@/components/SubjectEmoji/SubjectEmoji";
import { useDateFormats } from "@/hooks/useFormats";
import {
  currentPeriod,
  type GradeView,
  type PeriodView,
  useGrades,
} from "@/hooks/useGrades";
import { useJump } from "@/hooks/useJump";
import { useNow } from "@/hooks/useNow";
import { matches } from "@/lib/search";
import type { ModulePageProps } from "@/modules/registry";
import { useAccountStore } from "@/stores/accounts";
import { type DetailContent, useDetailStore } from "@/stores/detail";
import { useSettingsStore } from "@/stores/settings";

import { GradesTable } from "./GradesTable";
import { GradeDetail, SubjectDetail } from "./NoteDetails";
import styles from "./notes.module.scss";
import { AverageCard, LatestGrades, StatsCard } from "./Overview";
import { SubjectCard } from "./SubjectCard";
import { type SubjectSummary, summarize } from "./subjects";

type Tab = "subjects" | "latest";
const SORTS = ["date", "average", "alphabetical"] as const;
type Sort = (typeof SORTS)[number];

const periodKey = (period: PeriodView) => `${period.serviceId}:${period.id}`;

export function NotesPage({ module }: ModulePageProps) {
  const { t } = useTranslation();
  const accountId =
    useAccountStore(state => state.currentAccountId) ?? undefined;
  const method = useSettingsStore(state => state.averageMethod);
  const openDetail = useDetailStore(state => state.open);
  const detailOpen = useDetailStore(state => state.content !== null);
  const formats = useDateFormats();
  const now = useNow();
  const data = useGrades(accountId);
  const [chosen, setChosen] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("subjects");
  const [sort, setSort] = useState<Sort>("date");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const periods = data.status === "ready" ? data.data.periods : [];
  const allGrades = data.status === "ready" ? data.data.grades : [];
  const period =
    periods.find(candidate => periodKey(candidate) === chosen) ??
    currentPeriod(periods, allGrades, now);
  const periodGrades = period
    ? allGrades.filter(
        grade =>
          grade.serviceId === period.serviceId && grade.periodId === period.id
      )
    : [];
  const shown = periodGrades.filter(grade =>
    matches(`${grade.label} ${grade.title}`, query)
  );
  const averages =
    data.status === "ready" && period
      ? data.data.averages.filter(
          average =>
            average.serviceId === period.serviceId &&
            average.periodId === period.id
        )
      : [];
  const summaries = summarize(shown, averages).sort((a, b) =>
    sort === "date"
      ? b.last - a.last
      : sort === "average"
        ? (b.average ?? -1) - (a.average ?? -1)
        : a.label.localeCompare(b.label, formats.locale)
  );

  const gradeDetail = (grade: GradeView): DetailContent => ({
    title: grade.title || grade.label,
    subtitle: `${grade.label} · ${formats.longDate.format(grade.date)}`,
    body: <GradeDetail grade={grade} all={periodGrades} method={method} />,
  });
  const openGrade = (grade: GradeView) => {
    setSelected(grade.id);
    openDetail(gradeDetail(grade));
  };
  // Une note choisie dans la palette : sa période, sans recherche.
  useJump(allGrades, !data.fetching, {
    aim: jump => {
      if (jump.periodId) {
        setChosen(`${jump.serviceId}:${jump.periodId}`);
      }
      setQuery("");
      setSelected(jump.id);
    },
    open: grade => openDetail(gradeDetail(grade)),
  });
  const openSubject = (summary: SubjectSummary) => {
    setSelected(null);
    openDetail({
      title: summary.label,
      subtitle: t("notes.subjectSubtitle", { count: summary.grades.length }),
      media: (
        <SubjectEmoji emoji={summary.emoji} color={summary.color} size={48} />
      ),
      body: <SubjectDetail summary={summary} />,
    });
  };

  const navigation =
    periods.length > 0 ? (
      <Menu
        label={period?.name ?? t("notes.period")}
        align="start"
        items={periods.map(candidate => ({
          kind: "option" as const,
          label: candidate.name,
          checked: candidate === period,
          onSelect: () => setChosen(periodKey(candidate)),
        }))}
      />
    ) : undefined;
  const actions = (
    <>
      <Segmented
        name="notes-tab"
        label={t("notes.view")}
        value={tab}
        options={[
          { value: "subjects", label: t("notes.tabs.subjects") },
          { value: "latest", label: t("notes.tabs.latest") },
        ]}
        onChange={setTab}
      />
      {!detailOpen && (
        <div className={styles.search}>
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={t("notes.search")}
          />
        </div>
      )}
      <Menu
        label={t("notes.sort")}
        icon={Filter}
        value={t(`notes.sorts.${sort}.title`)}
        stacked
        items={[
          { kind: "heading", label: t("notes.sortTitle") },
          ...SORTS.map(option => ({
            kind: "option" as const,
            label: t(`notes.sorts.${option}.title`),
            hint: t(`notes.sorts.${option}.text`),
            checked: option === sort,
            onSelect: () => setSort(option),
          })),
        ]}
      />
    </>
  );

  const other = [...periods]
    .reverse()
    .find(
      candidate =>
        candidate !== period &&
        allGrades.some(
          grade =>
            grade.serviceId === candidate.serviceId &&
            grade.periodId === candidate.id
        )
    );
  const selectedNow = detailOpen ? selected : null;

  const body =
    data.status === "error" ? (
      <EmptyState
        icon={module.icon}
        title={t("notes.error")}
        text={t("errors.database")}
      />
    ) : data.fetching && periodGrades.length === 0 ? (
      <div className={styles.empty}>
        <Spinner size="large" label={t("app.loading")} fill />
      </div>
    ) : periodGrades.length === 0 ? (
      <Card className={styles.empty}>
        <EmptyState
          icon={module.icon}
          title={t("notes.empty.title")}
          text={t("notes.empty.text")}
          action={
            other && {
              label: t("notes.empty.action", { period: other.name }),
              onClick: () => setChosen(periodKey(other)),
            }
          }
        />
      </Card>
    ) : tab === "latest" ? (
      <GradesTable
        grades={shown}
        all={periodGrades}
        method={method}
        selected={selectedNow}
        onOpen={openGrade}
      />
    ) : (
      <>
        <div className={styles.top}>
          <AverageCard grades={periodGrades} period={period} />
          {!detailOpen && (
            <StatsCard
              period={period}
              subjects={summarize(periodGrades, averages)}
              count={periodGrades.length}
            />
          )}
        </div>
        <LatestGrades grades={shown} now={now} onOpen={openGrade} />
        <section aria-labelledby="notes-subjects">
          <h3 id="notes-subjects" className={styles.sectionHead}>
            <Grid size={15} aria-hidden="true" />
            {t("notes.tabs.subjects")}
            <span>
              {t("notes.subjectsCount", { count: summaries.length })} ·{" "}
              {t("notes.gradesCount", { count: shown.length })}
            </span>
          </h3>
          <div className={styles.subjects}>
            {summaries.map(summary => (
              <SubjectCard
                key={summary.subject}
                summary={summary}
                selected={selectedNow}
                onOpenSubject={openSubject}
                onOpenGrade={openGrade}
              />
            ))}
          </div>
        </section>
      </>
    );

  return (
    <Page
      title={t("modules.notes")}
      navigation={navigation}
      actions={actions}
      flat
    >
      <div className={styles.page} data-detail-open={detailOpen || undefined}>
        {body}
      </div>
    </Page>
  );
}
