// Courbe d'évolution (maquettes : `line_chart`) : trait lissé de la couleur du parent
// (`color`), aire dégradée dessous, point sur la dernière valeur. Au survol, une ligne et une
// bulle donnent la date et la valeur la plus proche.
import { type MouseEvent, useId, useState } from "react";

import styles from "./LineChart.module.scss";

export interface ChartPoint {
  date: Date;
  value: number;
}

export function LineChart({
  points,
  label,
  formatDate,
  formatValue,
  hover = true,
}: {
  points: readonly ChartPoint[];
  /** Ce que montre la courbe, pour les lecteurs d'écran. */
  label: string;
  formatDate: (date: Date) => string;
  formatValue: (value: number) => string;
  /** Bulle au survol ; sans elle, une petite courbe décorative. */
  hover?: boolean;
}) {
  const gradient = `courbe-${useId().replace(/[^a-z0-9]/gi, "")}`;
  const [active, setActive] = useState<number | null>(null);
  if (points.length < 2) {
    return <div className={styles.chart} />;
  }
  const values = points.map(point => point.value);
  const lo = Math.min(...values) - 0.5;
  const hi = Math.max(...values) + 0.5;
  const x = (index: number) => (index / (points.length - 1)) * 100;
  const y = (value: number) => 100 - ((value - lo) / (hi - lo)) * 100;
  let line = `M0 ${y(values[0] ?? 0)}`;
  for (let i = 1; i < points.length; i++) {
    const middle = (x(i - 1) + x(i)) / 2;
    line += ` C${middle} ${y(values[i - 1] ?? 0)} ${middle} ${y(values[i] ?? 0)} ${x(i)} ${y(values[i] ?? 0)}`;
  }
  const last = points.length - 1;
  const point = active === null ? undefined : points[active];

  const onMove = (event: MouseEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    setActive(Math.round(Math.min(1, Math.max(0, ratio)) * last));
  };

  return (
    <div
      className={styles.chart}
      role="img"
      aria-label={label}
      onMouseMove={hover ? onMove : undefined}
      onMouseLeave={() => setActive(null)}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} L100 100 L0 100 Z`} fill={`url(#${gradient})`} />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className={styles.marker}
        style={{ "--x": x(last), "--y": y(values[last] ?? 0) }}
      />
      {point && active !== null && (
        <>
          <span className={styles.hoverLine} style={{ "--x": x(active) }} />
          <span className={styles.tooltip} style={{ "--x": x(active) }}>
            <small>{formatDate(point.date)}</small>
            <b>{formatValue(point.value)}</b>
          </span>
        </>
      )}
    </div>
  );
}
