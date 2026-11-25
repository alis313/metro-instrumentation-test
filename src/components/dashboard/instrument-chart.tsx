"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Line,
  ComposedChart,
  Legend,
} from "recharts";
import {
  Instrument,
  InstrumentType,
  INSTRUMENT_TYPES,
  fmtDateTimeFa,
  fmtNum,
} from "@/lib/instrument-data";
import { useTheme } from "next-themes";

interface InstrumentChartProps {
  instrument: Instrument;
}

const TYPE_COLORS: Record<InstrumentType, string> = {
  extensometer: "#0d7d6c",
  inclinometer: "#b45309",
  tiltmeter: "#15803d",
  observation_well: "#7c3aed",
  jointmeter: "#b91c1c",
};

// Build merged chart data from multi-series readings
function buildMultiSeriesData(
  series: { label: string; color: string; readings: { t: number; value: number }[] }[]
) {
  // Collect all unique timestamps
  const timeMap = new Map<number, Record<string, number>>();
  for (const s of series) {
    for (const r of s.readings) {
      if (!timeMap.has(r.t)) {
        timeMap.set(r.t, { t: r.t });
      }
      const entry = timeMap.get(r.t)!;
      entry[s.label] = r.value;
    }
  }
  // Sort by time
  return Array.from(timeMap.values()).sort((a, b) => a.t - b.t);
}

export function InstrumentChart({ instrument }: InstrumentChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const color = TYPE_COLORS[instrument.type];
  const meta = INSTRUMENT_TYPES[instrument.type];

  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const tickColor = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)";
  const fmtTs = (ts: number) => {
    try {
      return new Intl.DateTimeFormat("fa-IR", {
        month: "short",
        day: "numeric",
      }).format(new Date(ts));
    } catch {
      return new Date(ts).toISOString().slice(5, 10);
    }
  };

  // Check if multi-series data is available
  const hasSeries = instrument.series && instrument.series.length > 0;

  // Multi-series chart data
  const multiData = React.useMemo(() => {
    if (!hasSeries) return [];
    return buildMultiSeriesData(instrument.series!);
  }, [instrument, hasSeries]);

  // Single-series chart data (fallback)
  const singleData = React.useMemo(() => {
    return instrument.readings.map((r) => ({
      t: r.t,
      v: Number(r.value.toFixed(4)),
      label: fmtDateTimeFa(r.t),
    }));
  }, [instrument]);

  if (hasSeries) {
    // ─── Multi-series chart (all anchor depths + surface settlement) ───
    return (
      <div className="px-2 pb-3 pt-2 sm:px-4">
        {/* Legend for anchor depths */}
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {instrument.series!.map((s) => (
            <span
              key={s.label}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
            >
              <span
                className="h-1.5 w-3 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
            </span>
          ))}
          <span className="ms-auto text-[10px] text-muted-foreground">
            واحد: {instrument.unit}
          </span>
        </div>

        <div className="h-56 w-full sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={multiData}
              margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
            >
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis
                dataKey="t"
                tickFormatter={fmtTs}
                tick={{ fontSize: 10, fill: tickColor }}
                tickLine={false}
                axisLine={{ stroke: gridColor }}
                minTickGap={32}
              />
              <YAxis
                tick={{ fontSize: 10, fill: tickColor }}
                tickLine={false}
                axisLine={{ stroke: gridColor }}
                width={52}
                tickFormatter={(v) => fmtNum(Number(v), 1)}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(255,255,255,0.98)",
                  border: "1px solid rgba(0,0,0,0.15)",
                  borderRadius: 8,
                  fontSize: 12,
                  fontFamily: "inherit",
                  direction: "rtl",
                  color: "#1a1a1a",
                  padding: "8px 12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  maxWidth: "350px",
                  overflow: "visible",
                  zIndex: 9999,
                }}
                itemStyle={{
                  color: "#1a1a1a",
                  padding: "2px 0",
                  whiteSpace: "nowrap",
                }}
                labelStyle={{ color: "#666", marginBottom: "4px", fontSize: 11 }}
                labelFormatter={(label) => fmtDateTimeFa(Number(label))}
                formatter={(value: number, name: string) => [
                  <span
                    key="val"
                    dir="ltr"
                    style={{ display: "inline-block", unicodeBidi: "isolate" }}
                  >
                    {fmtNum(Number(value))} {instrument.unit}
                  </span>,
                  name,
                ]}
              />
              {instrument.series!.map((s) => (
                <Line
                  key={s.label}
                  type="monotone"
                  dataKey={s.label}
                  stroke={s.color}
                  strokeWidth={1.8}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 1 }}
                  isAnimationActive={false}
                  connectNulls
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // ─── Single-series chart (for non-Excel instruments) ───
  return (
    <div className="px-2 pb-3 pt-2 sm:px-4">
      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span
            className="h-1.5 w-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          مقدار اندازه‌گیری ({meta.unit})
        </span>
      </div>

      <div className="h-56 w-full sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={singleData}
            margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
          >
            <defs>
              <linearGradient
                id={`grad-${instrument.id}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
            <XAxis
              dataKey="t"
              tickFormatter={fmtTs}
              tick={{ fontSize: 10, fill: tickColor }}
              tickLine={false}
              axisLine={{ stroke: gridColor }}
              minTickGap={32}
            />
            <YAxis
              tick={{ fontSize: 10, fill: tickColor }}
              tickLine={false}
              axisLine={{ stroke: gridColor }}
              width={52}
              tickFormatter={(v) => fmtNum(Number(v), 2)}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(255,255,255,0.98)",
                border: "1px solid rgba(0,0,0,0.15)",
                borderRadius: 8,
                fontSize: 12,
                fontFamily: "inherit",
                direction: "rtl",
                color: "#1a1a1a",
                padding: "8px 12px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                maxWidth: "350px",
                overflow: "visible",
                zIndex: 9999,
              }}
              itemStyle={{
                color: "#1a1a1a",
                padding: "2px 0",
                whiteSpace: "nowrap",
              }}
              labelStyle={{ color: "#666", marginBottom: "4px", fontSize: 11 }}
              labelFormatter={(label) => fmtDateTimeFa(Number(label))}
              formatter={(value: number) => [
                <span
                  key="val"
                  dir="ltr"
                  style={{ display: "inline-block", unicodeBidi: "isolate" }}
                >
                  {fmtNum(Number(value))} {instrument.unit}
                </span>,
                instrument.label,
              ]}
            />
            <Line
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 4,
                strokeWidth: 2,
                stroke: isDark ? "#fff" : "#000",
              }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
