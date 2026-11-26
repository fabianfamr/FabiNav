import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { Activity } from 'lucide-react';
import { AppLanguage, ShieldSessionEvent } from '../types';
import { t } from '../i18n/translations';

interface ShieldSessionChartProps {
  events: ShieldSessionEvent[];
  language?: AppLanguage;
  compact?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload?: ShieldSessionEvent & { shortDomain?: string };
  }>;
  language: AppLanguage;
}

const ShieldChartTooltip: React.FC<CustomTooltipProps> = ({ active, payload, language }) => {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="rounded-xl border border-[var(--bn-border-strong)] bg-[var(--bn-surface)] px-2.5 py-2 shadow-xl text-[11px] text-[var(--bn-text)] min-w-[164px]">
      <div className="flex items-center justify-between gap-2 pb-1 mb-1 border-b border-[var(--bn-border)]">
        <span className="font-semibold text-[var(--bn-text-strong)] truncate max-w-[120px]">
          {item.domain}
        </span>
        <span className="font-mono text-[10px] text-[var(--bn-text-muted)] tabular-nums shrink-0">
          {item.timeLabel}
        </span>
      </div>
      <div className="space-y-0.5 tabular-nums">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[var(--bn-text-muted)]">
            <span className="w-2 h-2 rounded-sm bg-[#fb542b]" />
            <span>{t(language, 'shieldsChartTrackers')}</span>
          </span>
          <span className="font-mono font-semibold text-[var(--bn-text-strong)]">
            {item.trackers}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[var(--bn-text-muted)]">
            <span className="w-2 h-2 rounded-sm bg-[#ff5cb3]" />
            <span>{t(language, 'shieldsChartCookies')}</span>
          </span>
          <span className="font-mono font-semibold text-[var(--bn-text-strong)]">
            {item.cookies}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[var(--bn-text-muted)]">
            <span className="w-2 h-2 rounded-sm bg-[#10b981]" />
            <span>{t(language, 'shieldsChartHttps')}</span>
          </span>
          <span className="font-mono font-semibold text-[var(--bn-text-strong)]">
            {item.httpsUpgrades}
          </span>
        </div>
      </div>
    </div>
  );
};

export const ShieldSessionChart: React.FC<ShieldSessionChartProps> = ({
  events,
  language = 'es',
  compact = false
}) => {
  const chartData = useMemo(() => {
    const sliceCount = compact ? 10 : 20;
    return events.slice(-sliceCount).map((ev) => ({
      ...ev,
      shortDomain:
        ev.domain.length > (compact ? 9 : 14)
          ? `${ev.domain.slice(0, compact ? 8 : 13)}…`
          : ev.domain
    }));
  }, [events, compact]);

  const totals = useMemo(() => {
    return events.reduce(
      (acc, ev) => {
        acc.trackers += ev.trackers;
        acc.cookies += ev.cookies;
        acc.httpsUpgrades += ev.httpsUpgrades;
        return acc;
      },
      { trackers: 0, cookies: 0, httpsUpgrades: 0 }
    );
  }, [events]);

  const chartHeight = compact ? 104 : 190;

  return (
    <div
      className={`rounded-xl bg-[var(--bn-surface-alt)] border border-[var(--bn-border)] ${
        compact ? 'p-3 space-y-2' : 'p-4 space-y-3 rounded-2xl'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[var(--bn-accent)] shrink-0" />
            <h5
              className={`${
                compact ? 'text-[11px]' : 'text-xs'
              } font-semibold text-[var(--bn-text-strong)] truncate`}
            >
              {t(language, 'shieldsSessionChartTitle')}
            </h5>
          </div>
          {!compact && (
            <p className="text-[11px] text-[var(--bn-text-muted)] mt-0.5">
              {t(language, 'shieldsSessionChartSubtitle')}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2.5 text-[10px] text-[var(--bn-text-muted)] tabular-nums shrink-0">
          <span className="flex items-center gap-1" title={t(language, 'shieldsChartTrackers')}>
            <span className="w-2 h-2 rounded-sm bg-[#fb542b]" />
            <span className="font-mono text-[var(--bn-text-strong)]">{totals.trackers}</span>
          </span>
          <span className="flex items-center gap-1" title={t(language, 'shieldsChartCookies')}>
            <span className="w-2 h-2 rounded-sm bg-[#ff5cb3]" />
            <span className="font-mono text-[var(--bn-text-strong)]">{totals.cookies}</span>
          </span>
          <span className="flex items-center gap-1" title={t(language, 'shieldsChartHttps')}>
            <span className="w-2 h-2 rounded-sm bg-[#10b981]" />
            <span className="font-mono text-[var(--bn-text-strong)]">{totals.httpsUpgrades}</span>
          </span>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div
          style={{ height: chartHeight }}
          className="flex flex-col items-center justify-center text-center px-3 rounded-lg bg-[var(--bn-surface)]/45 border border-dashed border-[var(--bn-border)]"
        >
          <p className="text-[11px] text-[var(--bn-text-muted)] leading-relaxed max-w-[260px]">
            {t(language, 'shieldsSessionChartEmpty')}
          </p>
        </div>
      ) : (
        <div className="w-full" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height={chartHeight} minWidth={0}>
            <BarChart
              data={chartData}
              margin={
                compact
                  ? { top: 4, right: 4, left: -26, bottom: 0 }
                  : { top: 6, right: 8, left: -18, bottom: 0 }
              }
              barCategoryGap={compact ? '22%' : '26%'}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--bn-border)"
                strokeOpacity={0.75}
              />
              <XAxis
                dataKey="shortDomain"
                tick={{ fill: 'var(--bn-text-muted)', fontSize: compact ? 9 : 10 }}
                axisLine={{ stroke: 'var(--bn-border)' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: 'var(--bn-text-muted)', fontSize: compact ? 9 : 10 }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                cursor={{ fill: 'var(--bn-hover)', opacity: 0.45 }}
                content={<ShieldChartTooltip language={language} />}
              />
              <Bar
                dataKey="trackers"
                stackId="shields"
                fill="#fb542b"
                radius={[2, 2, 0, 0]}
                maxBarSize={compact ? 18 : 26}
              />
              <Bar
                dataKey="cookies"
                stackId="shields"
                fill="#ff5cb3"
                radius={[2, 2, 0, 0]}
                maxBarSize={compact ? 18 : 26}
              />
              <Bar
                dataKey="httpsUpgrades"
                stackId="shields"
                fill="#10b981"
                radius={[3, 3, 0, 0]}
                maxBarSize={compact ? 18 : 26}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
