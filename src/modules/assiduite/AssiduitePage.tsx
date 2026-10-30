// Assiduité (maquette 06-vie-scolaire/02-assiduite) : pour la période choisie, quatre chiffres
// (heures manquées, injustifiées, absences, retards), une alerte s'il reste à justifier, le
// tableau des absences et retards (détail à droite au clic) et les heures manquées par mois.
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Check,
  Clock,
  UserCross,
  Walk,
} from "@getpapillon/papicons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/Card/Card";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import { Menu } from "@/components/Menu/Menu";
import { Page } from "@/components/Page/Page";
import { Segmented } from "@/components/Segmented/Segmented";
import { SettingRow } from "@/components/SettingRow/SettingRow";
import { type AttendanceView, useAttendance } from "@/hooks/useAttendance";
import { capitalize, hoursMinutes, useDateFormats } from "@/hooks/useFormats";
import { currentPeriod, useGrades } from "@/hooks/useGrades";
import { useNow } from "@/hooks/useNow";
import type { ModulePageProps } from "@/modules/registry";
import { useAccountStore } from "@/stores/accounts";
import { useDetailStore } from "@/stores/detail";

import styles from "./assiduite.module.scss";

type Filter = "all" | "absence" | "delay";

export function AssiduitePage({ module }: ModulePageProps) {
  const { t } = useTranslation();
  const accountId =
    useAccountStore(state => state.currentAccountId) ?? undefined;
  const openDetail = useDetailStore(state => state.open);
  const detailOpen = useDetailStore(state => state.content !== null);
  const formats = useDateFormats();
  const now = useNow();
  const items = useAttendance(accountId);
  const grades = useGrades(accountId);
  const [chosen, setChosen] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);

  const periods = grades.status === "ready" ? grades.data.periods : [];
  const period =
    chosen === "year"
      ? undefined
      : (periods.find(candidate => candidate.id === chosen) ??
        (grades.status === "ready"
          ? currentPeriod(periods, grades.data.grades, now)
          : undefined));
  const all = (items.status === "ready" ? items.data : []).filter(
    item => !period || (item.from >= period.start && item.from <= period.end)
  );
  const shown = all.filter(item => filter === "all" || item.kind === filter);
  const absences = all.filter(item => item.kind === "absence");
  const delays = all.filter(item => item.kind === "delay");
  const missed = absences.reduce((sum, item) => sum + item.durationMinutes, 0);
  const unjustified = all
    .filter(item => !item.justified)
    .reduce((sum, item) => sum + item.durationMinutes, 0);
  const shortDay = new Intl.DateTimeFormat(formats.locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const month = new Intl.DateTimeFormat(formats.locale, { month: "long" });

  const status = (item: AttendanceView) =>
    t(
      `assiduite.status.${item.kind}.${item.justified ? "justified" : "unjustified"}`
    );
  const schedule = (item: AttendanceView) =>
    item.kind === "delay"
      ? formats.time.format(item.from)
      : t("cours.time", {
          from: formats.time.format(item.from),
          to: formats.time.format(item.to),
        });
  const open = (item: AttendanceView) => {
    setSelected(`${item.kind}:${item.id}`);
    openDetail({
      title: t(`assiduite.kinds.${item.kind}`),
      subtitle: capitalize(formats.longDate.format(item.from), formats.locale),
      body: (
        <Card rows>
          <SettingRow
            icon={Calendar}
            title={t("assiduite.table.schedule")}
            value={schedule(item)}
          />
          <SettingRow
            icon={Clock}
            title={t("assiduite.table.duration")}
            value={hoursMinutes(item.durationMinutes)}
          />
          <SettingRow
            icon={AlertCircle}
            title={t("assiduite.table.reason")}
            value={item.reason ?? t("assiduite.noReason")}
          />
          <SettingRow
            icon={item.justified ? Check : AlertTriangle}
            tone={item.justified ? "success" : "danger"}
            title={t("assiduite.table.status")}
            value={status(item)}
          />
        </Card>
      ),
    });
  };

  // Heures manquées par mois, de la plus ancienne à la plus récente.
  const months = [
    ...new Set(
      absences.map(item =>
        new Date(item.from.getFullYear(), item.from.getMonth(), 1).getTime()
      )
    ),
  ]
    .sort((a, b) => a - b)
    .map(start => {
      const own = absences.filter(
        item =>
          new Date(
            item.from.getFullYear(),
            item.from.getMonth(),
            1
          ).getTime() === start
      );
      return {
        start: new Date(start),
        total: own.reduce((sum, item) => sum + item.durationMinutes, 0),
        unjustified: own
          .filter(item => !item.justified)
          .reduce((sum, item) => sum + item.durationMinutes, 0),
      };
    });
  const longest = Math.max(1, ...months.map(row => row.total));

  const navigation =
    periods.length > 0 ? (
      <Menu
        label={period?.name ?? t("assiduite.year")}
        align="start"
        items={[
          ...periods.map(candidate => ({
            kind: "option" as const,
            label: candidate.name,
            checked: candidate === period,
            onSelect: () => setChosen(candidate.id),
          })),
          { kind: "separator" as const },
          {
            kind: "option" as const,
            label: t("assiduite.year"),
            checked: !period,
            onSelect: () => setChosen("year"),
          },
        ]}
      />
    ) : undefined;
  const actions = (
    <Segmented
      name="assiduite-filter"
      label={t("assiduite.filter")}
      value={filter}
      options={[
        { value: "all", label: t("assiduite.filters.all") },
        { value: "absence", label: t("assiduite.filters.absence") },
        { value: "delay", label: t("assiduite.filters.delay") },
      ]}
      onChange={setFilter}
    />
  );

  const stats = [
    {
      icon: Clock,
      tone: "accent",
      label: t("assiduite.stats.missed"),
      value: hoursMinutes(missed),
    },
    {
      icon: AlertTriangle,
      tone: "error",
      label: t("assiduite.stats.unjustified"),
      value: hoursMinutes(unjustified),
      alert: unjustified > 0,
    },
    {
      icon: UserCross,
      tone: "warning",
      label: t("assiduite.stats.absences"),
      value: String(absences.length),
    },
    {
      icon: Walk,
      tone: "info",
      label: t("assiduite.stats.delays"),
      value: String(delays.length),
    },
  ];

  const body =
    items.status === "loading" ? null : items.status === "error" ? (
      <EmptyState
        icon={module.icon}
        title={t("assiduite.error")}
        text={t("errors.database")}
      />
    ) : (
      <>
        <ul className={styles.stats}>
          {stats.map(stat => (
            <li key={stat.tone}>
              <Card className={styles.stat}>
                <span className={styles.statIcon} data-tone={stat.tone}>
                  <stat.icon size={16} aria-hidden="true" />
                </span>
                <span className={styles.statLabel}>{stat.label}</span>
                <strong data-alert={stat.alert || undefined}>
                  {stat.value}
                </strong>
              </Card>
            </li>
          ))}
        </ul>
        {unjustified > 0 && (
          <div className={styles.alert} role="status">
            <span aria-hidden="true">
              <AlertTriangle size={18} />
            </span>
            <p>
              <strong>
                {t("assiduite.alert.title", {
                  duration: hoursMinutes(unjustified),
                })}
              </strong>
              {t("assiduite.alert.text")}
            </p>
          </div>
        )}
        {shown.length === 0 ? (
          <Card className={styles.empty}>
            <EmptyState
              icon={module.icon}
              title={t("assiduite.empty.title")}
              text={t("assiduite.empty.text")}
            />
          </Card>
        ) : (
          <Card className={styles.tableCard}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t("assiduite.table.kind")}</th>
                  <th scope="col">{t("assiduite.table.reason")}</th>
                  <th scope="col">{t("assiduite.table.date")}</th>
                  <th scope="col">{t("assiduite.table.schedule")}</th>
                  <th scope="col">{t("assiduite.table.duration")}</th>
                  <th scope="col" data-end>
                    {t("assiduite.table.status")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map(item => {
                  const key = `${item.kind}:${item.id}`;
                  return (
                    <tr
                      key={`${item.serviceId}:${key}`}
                      data-selected={
                        (detailOpen && selected === key) || undefined
                      }
                      onClick={() => open(item)}
                    >
                      <td>
                        <span className={styles.kind} data-kind={item.kind}>
                          <span aria-hidden="true">
                            {item.kind === "absence" ? (
                              <UserCross size={16} />
                            ) : (
                              <Clock size={16} />
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={event => {
                              // La ligne l'ouvre déjà au clic ; le bouton sert au clavier.
                              event.stopPropagation();
                              open(item);
                            }}
                          >
                            {t(`assiduite.kinds.${item.kind}`)}
                          </button>
                        </span>
                      </td>
                      <td data-muted={!item.reason || undefined}>
                        {item.reason ?? t("assiduite.noReason")}
                      </td>
                      <td className={styles.soft}>
                        {capitalize(shortDay.format(item.from), formats.locale)}
                      </td>
                      <td className={styles.soft}>{schedule(item)}</td>
                      <td
                        className={styles.duration}
                        data-alert={!item.justified || undefined}
                      >
                        {hoursMinutes(item.durationMinutes)}
                      </td>
                      <td data-end>
                        <span
                          className={styles.status}
                          data-ok={item.justified || undefined}
                        >
                          {item.justified ? (
                            <Check size={12} aria-hidden="true" />
                          ) : (
                            <AlertCircle size={12} aria-hidden="true" />
                          )}
                          {status(item)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
        {months.length > 0 && (
          <Card className={styles.months}>
            <h2>{t("assiduite.byMonth")}</h2>
            <ul>
              {months.map(row => (
                <li key={row.start.getTime()}>
                  <span>
                    {capitalize(month.format(row.start), formats.locale)}
                  </span>
                  <span
                    className={styles.bar}
                    style={{ "--progress": row.total / longest }}
                  >
                    <span
                      style={{
                        "--progress": row.unjustified / Math.max(1, row.total),
                      }}
                    />
                  </span>
                  <b>{hoursMinutes(row.total)}</b>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </>
    );

  return (
    <Page
      title={t("modules.assiduite")}
      navigation={navigation}
      actions={actions}
      flat
    >
      <div className={styles.page}>{body}</div>
    </Page>
  );
}
