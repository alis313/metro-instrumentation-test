// Types and mock data generation for the metro instrumentation dashboard.
// All numbers below are synthetic but realistic engineering values.

export type InstrumentType =
  | "extensometer"
  | "inclinometer"
  | "tiltmeter"
  | "observation_well"
  | "jointmeter";

export type InstrumentStatus = "normal" | "warning" | "alarm" | "offline";

export interface Threshold {
  warning: number;
  alarm: number;
}

export interface ReadingPoint {
  t: number; // epoch ms
  value: number;
}

export interface Instrument {
  id: string;
  code: string;
  type: InstrumentType;
  stationId: string;
  label: string;
  location: string;
  unit: string;
  baseline: number;
  threshold: Threshold;
  // position on the station map (percent of the SVG viewBox 0..100)
  pos: { x: number; y: number };
  readings: ReadingPoint[];
  // multi-series support: when present, chart shows all anchor points
  series?: InstrumentSeries[];
  status: InstrumentStatus;
  lastReading: number;
  lastDelta: number; // change from baseline
  updatedAt: number;
}

export interface InstrumentSeries {
  label: string;
  color: string;
  readings: ReadingPoint[];
}

export interface Station {
  id: string;
  name: string;
  code: string;
  status: InstrumentStatus;
  instrumentCount: number;
  alertCount: number;
}

export type Direction = "vertical" | "horizontal";

export interface InstrumentTypeMeta {
  type: InstrumentType;
  nameFa: string;
  nameEn: string;
  description: string;
  icon: string; // lucide icon name
  unit: string;
  color: string; // chart color key
}

export const INSTRUMENT_TYPES: Record<InstrumentType, InstrumentTypeMeta> = {
  extensometer: {
    type: "extensometer",
    nameFa: "اکستنسومتر",
    nameEn: "Extensometer",
    description:
      "اندازه‌گیری جابجایی خاک در اطراف سازه زیرزمینی ایستگاه (نصب درون خاک)",
    icon: "Ruler",
    unit: "mm",
    color: "var(--chart-1)",
  },
  inclinometer: {
    type: "inclinometer",
    nameFa: "اینکلاینومتر",
    nameEn: "Inclinometer",
    description:
      "اندازه‌گیری حرکت جانبی خاک در عمق (نصب درون چاه‌های قائم در خاک)",
    icon: "MoveVertical",
    unit: "mm",
    color: "var(--chart-2)",
  },
  tiltmeter: {
    type: "tiltmeter",
    nameFa: "تیلت‌متر",
    nameEn: "Tiltmeter",
    description:
      "اندازه‌گیری کج‌شدگی ساختمان‌های حساس مجاور ایستگاه (نصب روی ساختمان)",
    icon: "TrendingUp",
    unit: "mm/m",
    color: "var(--chart-3)",
  },
  observation_well: {
    type: "observation_well",
    nameFa: "چاه مشاهده‌ای",
    nameEn: "Observation Well",
    description:
      "اندازه‌گیری تراز آبهای زیرزمینی در اطراف ایستگاه (نصب در خاک)",
    icon: "Droplets",
    unit: "m",
    color: "var(--chart-5)",
  },
  jointmeter: {
    type: "jointmeter",
    nameFa: "درزسنج",
    nameEn: "Jointmeter",
    description:
      "اندازه‌گیری بازشدگی درزهای سازه‌های مجاور ایستگاه (نصب روی درزها)",
    icon: "Split",
    unit: "mm",
    color: "var(--chart-4)",
  },
};

export interface StationDef {
  id: string;
  name: string;
  code: string;
}

export const STATION_DEFS: StationDef[] = [
  { id: "st-link", name: "سه راهی",          code: "Link" },
  { id: "st-n3",   name: "ایستگاه شهدا",      code: "N3" },
  { id: "st-o3",   name: "ایستگاه شارستان",   code: "O3" },
  { id: "st-p3",   name: "ایستگاه باب الجواد", code: "P3" },
  { id: "st-q3",   name: "ایستگاه دانش",      code: "Q3" },
  { id: "st-r3",   name: "ایستگاه بسیج",      code: "R3" },
];

// STATIONS is computed at the bottom of this file (after getInstrumentsForStation is defined).
// Forward-declared here so that other modules can import it.

// deterministic pseudo-random generator (seeded)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 23, 9, 30, 0); // 2026-11-23 09:30 — fixed "now"

// generates N daily readings ending at NOW
function genSeries(
  seed: number,
  days: number,
  baseline: number,
  drift: number, // total expected drift over the period
  noise: number,
  trendType: "linear" | "log" | "step" | "seasonal" = "linear"
): ReadingPoint[] {
  const rand = mulberry32(seed);
  const out: ReadingPoint[] = [];
  for (let i = 0; i < days; i++) {
    const frac = i / (days - 1);
    let trend: number;
    if (trendType === "linear") trend = drift * frac;
    else if (trendType === "log") trend = drift * Math.log(1 + 9 * frac) / Math.log(10);
    else if (trendType === "step") trend = drift * (frac > 0.6 ? 1 : frac > 0.3 ? 0.4 : 0.05);
    else trend = drift * frac + Math.sin(frac * Math.PI * 4) * drift * 0.15;
    const noiseVal = (rand() - 0.5) * 2 * noise;
    out.push({
      t: NOW - (days - 1 - i) * DAY,
      value: Number((baseline + trend + noiseVal).toFixed(4)),
    });
  }
  return out;
}

function statusFromDelta(deltaAbs: number, th: Threshold): InstrumentStatus {
  if (deltaAbs >= th.alarm) return "alarm";
  if (deltaAbs >= th.warning) return "warning";
  return "normal";
}

interface InstrumentSeed {
  code: string;
  type: InstrumentType;
  label: string;
  location: string;
  baseline: number;
  threshold: Threshold;
  pos: { x: number; y: number };
  // series params
  drift: number;
  noise: number;
  trend: "linear" | "log" | "step" | "seasonal";
  days: number;
  seed: number;
}

// Per-station instrument layout. Positions are on a 100x100 SVG canvas with
// station structure at center (50,50). Different instrument types occupy
// different "zones":
//   - extensometers: ring around the underground box (soil)
//   - inclinometers: outside the extensometer ring (deeper soil)
//   - tiltmeters: corner positions (on buildings outside)
//   - observation wells: scattered in soil
//   - jointmeters: on the perimeter of nearby structures
// Per-station instrument layout. Positions are on a 0..100 canvas for both x and y
// (the SVG scales x by 1.6 to make the canvas rectangular).
//
// Station st-n3 (شهدا) uses positions extracted from the actual site layout image:
//   - 7 extensometers (Ex-1..Ex-6 + Ex-4.1) along the road axis (NE→SW diagonal)
//   - 7 tiltmeters at the positions marked on the image
//   - 8 representative jointmeters (the actual site has ~45, but we show key ones)
//   - 2 inclinometers + 2 observation wells added at plausible off-image positions
//     (these types are not visible in the provided image but are part of the
//      monitoring programme per the project specification)
//
// Other stations use a symmetric "around the central station box" layout.
const STATION_LAYOUT: Record<string, InstrumentSeed[]> = {
  // === سه راهی (Link) — real data from Excel file, no mock data ===
  // Data is loaded from upload/Data Instrumentation-Link.xls via excel-reader.ts
  "st-link": [],

  // === شهدا (N3) — layout from the actual site image ===
  // Road axis runs diagonally from NE (top-right) to SW (bottom-left).
  // Excavation polygons along this axis; instruments placed per site plan.
  "st-n3": [
    // --- Extensometers (7) — exact positions from site image ---
    { code: "Ex-1",   type: "extensometer", label: "اکستنسومتر Ex-1",   location: "محور جاده - شمال شرق",   baseline: 0, threshold: { warning: 5, alarm: 10 }, pos: { x: 33, y: 12 }, drift: 3.4, noise: 0.35, trend: "linear", days: 90, seed: 201 },
    { code: "Ex-2",   type: "extensometer", label: "اکستنسومتر Ex-2",   location: "محور جاده - شمال",       baseline: 0, threshold: { warning: 5, alarm: 10 }, pos: { x: 22, y: 30 }, drift: 5.8, noise: 0.45, trend: "linear", days: 90, seed: 202 },
    { code: "Ex-3",   type: "extensometer", label: "اکستنسومتر Ex-3",   location: "محور جاده - مرکز شمالی", baseline: 0, threshold: { warning: 5, alarm: 10 }, pos: { x: 49, y: 25 }, drift: 7.2, noise: 0.5, trend: "log", days: 90, seed: 203 },
    { code: "Ex-4",   type: "extensometer", label: "اکستنسومتر Ex-4",   location: "محور جاده - مرکز جنوبی", baseline: 0, threshold: { warning: 5, alarm: 10 }, pos: { x: 56, y: 66 }, drift: 9.4, noise: 0.55, trend: "linear", days: 90, seed: 204 },
    { code: "Ex-4.1", type: "extensometer", label: "اکستنسومتر Ex-4.1", location: "محور جاده - جنوب",      baseline: 0, threshold: { warning: 5, alarm: 10 }, pos: { x: 60, y: 81 }, drift: 4.6, noise: 0.4, trend: "linear", days: 90, seed: 205 },
    { code: "Ex-5",   type: "extensometer", label: "اکستنسومتر Ex-5",   location: "محور جاده - جنوب شرق",  baseline: 0, threshold: { warning: 5, alarm: 10 }, pos: { x: 85, y: 79 }, drift: 2.8, noise: 0.3, trend: "linear", days: 90, seed: 206 },
    { code: "Ex-6",   type: "extensometer", label: "اکستنسومتر Ex-6",   location: "محور جاده - غرب مرکز",  baseline: 0, threshold: { warning: 5, alarm: 10 }, pos: { x: 15, y: 55 }, drift: 1.9, noise: 0.28, trend: "linear", days: 90, seed: 207 },

    // --- Tiltmeters (7) — exact positions from site image ---
    { code: "TM-01", type: "tiltmeter", label: "تیلت‌متر ساختمان شمال",  location: "ساختمان مجاور Ex-1",      baseline: 0, threshold: { warning: 1.2, alarm: 2.4 }, pos: { x: 40, y: 15 }, drift: 0.42, noise: 0.06, trend: "linear", days: 90, seed: 211 },
    { code: "TM-02", type: "tiltmeter", label: "تیلت‌متر ساختمان غربی",   location: "ساختمان مجاور Ex-2",      baseline: 0, threshold: { warning: 1.2, alarm: 2.4 }, pos: { x: 14, y: 38 }, drift: 0.18, noise: 0.05, trend: "linear", days: 90, seed: 212 },
    { code: "TM-03", type: "tiltmeter", label: "تیلت‌متر ساختمان جنوب 1", location: "ساختمان مجاور Ex-4.1",    baseline: 0, threshold: { warning: 1.2, alarm: 2.4 }, pos: { x: 48, y: 75 }, drift: 1.65, noise: 0.09, trend: "step", days: 90, seed: 213 },
    { code: "TM-04", type: "tiltmeter", label: "تیلت‌متر ساختمان جنوب 2", location: "ساختمان مجاور Ex-4.1",    baseline: 0, threshold: { warning: 1.2, alarm: 2.4 }, pos: { x: 52, y: 78 }, drift: 0.85, noise: 0.07, trend: "linear", days: 90, seed: 214 },
    { code: "TM-05", type: "tiltmeter", label: "تیلت‌متر ساختمان جنوب 3", location: "ساختمان جنوب مرکزی",      baseline: 0, threshold: { warning: 1.2, alarm: 2.4 }, pos: { x: 56, y: 86 }, drift: 0.32, noise: 0.05, trend: "linear", days: 90, seed: 215 },
    { code: "TM-06", type: "tiltmeter", label: "تیلت‌متر ساختمان جنوب 4", location: "ساختمان جنوب شرقی",       baseline: 0, threshold: { warning: 1.2, alarm: 2.4 }, pos: { x: 61, y: 89 }, drift: 0.25, noise: 0.05, trend: "linear", days: 90, seed: 216 },
    { code: "TM-07", type: "tiltmeter", label: "تیلت‌متر ساختمان شرق",    location: "ساختمان شرق مرکزی",       baseline: 0, threshold: { warning: 1.2, alarm: 2.4 }, pos: { x: 67, y: 91 }, drift: 0.15, noise: 0.04, trend: "linear", days: 90, seed: 217 },

    // --- Jointmeters (8 representative, site has ~45) ---
    { code: "JM-01", type: "jointmeter", label: "درزسنج درز شمال 1",   location: "درز سازه مجاور Ex-1",  baseline: 0, threshold: { warning: 2, alarm: 4 }, pos: { x: 38, y: 8 },  drift: 0.8, noise: 0.08, trend: "linear", days: 90, seed: 221 },
    { code: "JM-02", type: "jointmeter", label: "درزسنج درز شمال 2",   location: "درز سازه مجاور Ex-3",  baseline: 0, threshold: { warning: 2, alarm: 4 }, pos: { x: 50, y: 18 }, drift: 1.4, noise: 0.1, trend: "linear", days: 90, seed: 222 },
    { code: "JM-03", type: "jointmeter", label: "درزسنج درز شمال 3",   location: "درز سازه مجاور Ex-3",  baseline: 0, threshold: { warning: 2, alarm: 4 }, pos: { x: 52, y: 25 }, drift: 2.6, noise: 0.12, trend: "step", days: 90, seed: 223 },
    { code: "JM-04", type: "jointmeter", label: "درزسنج درز شرق",      location: "درز سازه مجاور Ex-5",  baseline: 0, threshold: { warning: 2, alarm: 4 }, pos: { x: 71, y: 40 }, drift: 0.6, noise: 0.07, trend: "linear", days: 90, seed: 224 },
    { code: "JM-05", type: "jointmeter", label: "درزسنج درز جنوب 1",   location: "درز سازه مجاور Ex-4",  baseline: 0, threshold: { warning: 2, alarm: 4 }, pos: { x: 55, y: 72 }, drift: 3.2, noise: 0.14, trend: "step", days: 90, seed: 225 },
    { code: "JM-06", type: "jointmeter", label: "درزسنج درز جنوب 2",   location: "درز سازه مجاور Ex-5",  baseline: 0, threshold: { warning: 2, alarm: 4 }, pos: { x: 88, y: 65 }, drift: 1.1, noise: 0.09, trend: "linear", days: 90, seed: 226 },
    { code: "JM-07", type: "jointmeter", label: "درزسنج درز جنوب 3",   location: "درز سازه مجاور Ex-4.1", baseline: 0, threshold: { warning: 2, alarm: 4 }, pos: { x: 65, y: 92 }, drift: 0.5, noise: 0.06, trend: "linear", days: 90, seed: 227 },
    { code: "JM-08", type: "jointmeter", label: "درزسنج درز غرب",      location: "درز سازه غربی",        baseline: 0, threshold: { warning: 2, alarm: 4 }, pos: { x: 24, y: 36 }, drift: 0.9, noise: 0.08, trend: "linear", days: 90, seed: 228 },

    // --- Inclinometers (2) — not in image but part of monitoring programme ---
    { code: "INC-01", type: "inclinometer", label: "اینکلاینومتر A", location: "خاک شمال شرق - عمق 22m", baseline: 0, threshold: { warning: 12, alarm: 22 }, pos: { x: 75, y: 30 }, drift: 8.5, noise: 0.7, trend: "log", days: 90, seed: 231 },
    { code: "INC-02", type: "inclinometer", label: "اینکلاینومتر B", location: "خاک جنوب غرب - عمق 22m", baseline: 0, threshold: { warning: 12, alarm: 22 }, pos: { x: 18, y: 72 }, drift: 4.8, noise: 0.5, trend: "linear", days: 90, seed: 232 },

    // --- Observation wells (2) — not in image but part of monitoring programme ---
    { code: "OW-01", type: "observation_well", label: "چاه مشاهده‌ای شمال", location: "تراز آب زیرزمینی شمال", baseline: 14.0, threshold: { warning: 2, alarm: 4 }, pos: { x: 80, y: 50 }, drift: 1.2, noise: 0.12, trend: "seasonal", days: 90, seed: 241 },
    { code: "OW-02", type: "observation_well", label: "چاه مشاهده‌ای جنوب", location: "تراز آب زیرزمینی جنوب", baseline: 13.8, threshold: { warning: 2, alarm: 4 }, pos: { x: 90, y: 88 }, drift: 0.7, noise: 0.1, trend: "seasonal", days: 90, seed: 242 },
  ],

  // === شارستان (O3) — alarm station for visual variety ===
  "st-o3": [
    { code: "EX-01", type: "extensometer", label: "اکستنسومتر شمالی", location: "خاک شمال سازه - عمق 14m", baseline: 0, threshold: { warning: 5, alarm: 10 }, pos: { x: 50, y: 30 }, drift: 9.4, noise: 0.6, trend: "linear", days: 90, seed: 111 },
    { code: "EX-02", type: "extensometer", label: "اکستنسومتر جنوبی", location: "خاک جنوب سازه - عمق 14m", baseline: 0, threshold: { warning: 5, alarm: 10 }, pos: { x: 50, y: 70 }, drift: 6.1, noise: 0.5, trend: "log", days: 90, seed: 112 },
    { code: "EX-03", type: "extensometer", label: "اکستنسومتر شرقی", location: "خاک شرق سازه - عمق 16m", baseline: 0, threshold: { warning: 5, alarm: 10 }, pos: { x: 70, y: 50 }, drift: 3.0, noise: 0.35, trend: "linear", days: 90, seed: 113 },
    { code: "INC-01", type: "inclinometer", label: "اینکلاینومتر A", location: "شمال شرق - عمق 24m", baseline: 0, threshold: { warning: 12, alarm: 22 }, pos: { x: 75, y: 25 }, drift: 23.6, noise: 1.0, trend: "linear", days: 90, seed: 121 },
    { code: "INC-02", type: "inclinometer", label: "اینکلاینومتر B", location: "جنوب غرب - عمق 24m", baseline: 0, threshold: { warning: 12, alarm: 22 }, pos: { x: 25, y: 75 }, drift: 7.8, noise: 0.7, trend: "log", days: 90, seed: 122 },
    { code: "TM-01", type: "tiltmeter", label: "تیلت‌متر ساختمان قدیمی", location: "ساختمان مسکونی شمال شرق", baseline: 0, threshold: { warning: 1.2, alarm: 2.4 }, pos: { x: 88, y: 18 }, drift: 2.65, noise: 0.1, trend: "step", days: 90, seed: 131 },
    { code: "TM-02", type: "tiltmeter", label: "تیلت‌متر مدرسه", location: "مدرسه جنوب", baseline: 0, threshold: { warning: 1.2, alarm: 2.4 }, pos: { x: 12, y: 85 }, drift: 1.4, noise: 0.08, trend: "linear", days: 90, seed: 132 },
    { code: "OW-01", type: "observation_well", label: "چاه مشاهده‌ای شمال", location: "تراز آب زیرزمینی شمال", baseline: 13.8, threshold: { warning: 2, alarm: 4 }, pos: { x: 35, y: 22 }, drift: 2.4, noise: 0.18, trend: "seasonal", days: 90, seed: 141 },
    { code: "OW-02", type: "observation_well", label: "چاه مشاهده‌ای شرق", location: "تراز آب زیرزمینی شرق", baseline: 13.5, threshold: { warning: 2, alarm: 4 }, pos: { x: 78, y: 35 }, drift: 1.0, noise: 0.12, trend: "seasonal", days: 90, seed: 142 },
    { code: "JM-01", type: "jointmeter", label: "درزسنج درز 1", location: "درز پل مجاور", baseline: 0, threshold: { warning: 2, alarm: 4 }, pos: { x: 58, y: 22 }, drift: 4.4, noise: 0.15, trend: "step", days: 90, seed: 151 },
    { code: "JM-02", type: "jointmeter", label: "درزسنج درز 2", location: "درز سازه جنوب", baseline: 0, threshold: { warning: 2, alarm: 4 }, pos: { x: 42, y: 78 }, drift: 1.2, noise: 0.1, trend: "linear", days: 90, seed: 152 },
    { code: "JM-03", type: "jointmeter", label: "درزسنج درز 3", location: "درز دیوار حائل", baseline: 0, threshold: { warning: 2, alarm: 4 }, pos: { x: 80, y: 70 }, drift: 0.8, noise: 0.08, trend: "linear", days: 90, seed: 153 },
  ],

  // === باب الجواد (P3) — normal status ===
  "st-p3": [
    { code: "EX-01", type: "extensometer", label: "اکستنسومتر شمالی", location: "خاک شمال سازه - عمق 11m", baseline: 0, threshold: { warning: 5, alarm: 10 }, pos: { x: 50, y: 30 }, drift: 1.2, noise: 0.3, trend: "linear", days: 90, seed: 211 },
    { code: "EX-02", type: "extensometer", label: "اکستنسومتر جنوبی", location: "خاک جنوب سازه - عمق 11m", baseline: 0, threshold: { warning: 5, alarm: 10 }, pos: { x: 50, y: 70 }, drift: 1.8, noise: 0.3, trend: "linear", days: 90, seed: 212 },
    { code: "EX-03", type: "extensometer", label: "اکستنسومتر شرقی", location: "خاک شرق سازه - عمق 13m", baseline: 0, threshold: { warning: 5, alarm: 10 }, pos: { x: 70, y: 50 }, drift: 0.9, noise: 0.25, trend: "linear", days: 90, seed: 213 },
    { code: "EX-04", type: "extensometer", label: "اکستنسومتر غربی", location: "خاک غرب سازه - عمق 13m", baseline: 0, threshold: { warning: 5, alarm: 10 }, pos: { x: 30, y: 50 }, drift: 0.7, noise: 0.25, trend: "linear", days: 90, seed: 214 },
    { code: "INC-01", type: "inclinometer", label: "اینکلاینومتر A", location: "شمال شرق - عمق 20m", baseline: 0, threshold: { warning: 12, alarm: 22 }, pos: { x: 75, y: 25 }, drift: 3.2, noise: 0.5, trend: "linear", days: 90, seed: 221 },
    { code: "INC-02", type: "inclinometer", label: "اینکلاینومتر B", location: "جنوب غرب - عمق 20m", baseline: 0, threshold: { warning: 12, alarm: 22 }, pos: { x: 25, y: 75 }, drift: 2.6, noise: 0.4, trend: "linear", days: 90, seed: 222 },
    { code: "TM-01", type: "tiltmeter", label: "تیلت‌متر ساختمان بانک", location: "بانک شمال شرق", baseline: 0, threshold: { warning: 1.2, alarm: 2.4 }, pos: { x: 88, y: 18 }, drift: 0.18, noise: 0.05, trend: "linear", days: 90, seed: 231 },
    { code: "TM-02", type: "tiltmeter", label: "تیلت‌متر خانه فرهنگ", location: "خانه فرهنگ جنوب", baseline: 0, threshold: { warning: 1.2, alarm: 2.4 }, pos: { x: 12, y: 85 }, drift: 0.12, noise: 0.05, trend: "linear", days: 90, seed: 232 },
    { code: "OW-01", type: "observation_well", label: "چاه مشاهده‌ای شمال", location: "تراز آب زیرزمینی شمال", baseline: 15.2, threshold: { warning: 2, alarm: 4 }, pos: { x: 35, y: 22 }, drift: 0.4, noise: 0.1, trend: "seasonal", days: 90, seed: 241 },
    { code: "OW-02", type: "observation_well", label: "چاه مشاهده‌ای جنوب", location: "تراز آب زیرزمینی جنوب", baseline: 15.0, threshold: { warning: 2, alarm: 4 }, pos: { x: 65, y: 78 }, drift: 0.3, noise: 0.1, trend: "seasonal", days: 90, seed: 242 },
    { code: "JM-01", type: "jointmeter", label: "درزسنج درز 1", location: "درز سازه مجاور شمال", baseline: 0, threshold: { warning: 2, alarm: 4 }, pos: { x: 58, y: 22 }, drift: 0.4, noise: 0.08, trend: "linear", days: 90, seed: 251 },
    { code: "JM-02", type: "jointmeter", label: "درزسنج درز 2", location: "درز سازه مجاور جنوب", baseline: 0, threshold: { warning: 2, alarm: 4 }, pos: { x: 42, y: 78 }, drift: 0.3, noise: 0.07, trend: "linear", days: 90, seed: 252 },
    { code: "JM-03", type: "jointmeter", label: "درزسنج درز 3", location: "درز سازه مجاور شرق", baseline: 0, threshold: { warning: 2, alarm: 4 }, pos: { x: 80, y: 50 }, drift: 0.2, noise: 0.06, trend: "linear", days: 90, seed: 253 },
  ],

  // === دانش (Q3) — warning status ===
  "st-q3": [
    { code: "EX-01", type: "extensometer", label: "اکستنسومتر شمالی", location: "خاک شمال سازه - عمق 12m", baseline: 0, threshold: { warning: 5, alarm: 10 }, pos: { x: 50, y: 30 }, drift: 5.6, noise: 0.45, trend: "log", days: 90, seed: 311 },
    { code: "EX-02", type: "extensometer", label: "اکستنسومتر جنوبی", location: "خاک جنوب سازه - عمق 12m", baseline: 0, threshold: { warning: 5, alarm: 10 }, pos: { x: 50, y: 70 }, drift: 2.8, noise: 0.35, trend: "linear", days: 90, seed: 312 },
    { code: "EX-03", type: "extensometer", label: "اکستنسومتر شرقی", location: "خاک شرق سازه - عمق 14m", baseline: 0, threshold: { warning: 5, alarm: 10 }, pos: { x: 70, y: 50 }, drift: 2.0, noise: 0.3, trend: "linear", days: 90, seed: 313 },
    { code: "INC-01", type: "inclinometer", label: "اینکلاینومتر A", location: "شمال شرق - عمق 21m", baseline: 0, threshold: { warning: 12, alarm: 22 }, pos: { x: 75, y: 25 }, drift: 8.2, noise: 0.7, trend: "log", days: 90, seed: 321 },
    { code: "INC-02", type: "inclinometer", label: "اینکلاینومتر B", location: "جنوب غرب - عمق 21m", baseline: 0, threshold: { warning: 12, alarm: 22 }, pos: { x: 25, y: 75 }, drift: 4.0, noise: 0.5, trend: "linear", days: 90, seed: 322 },
    { code: "TM-01", type: "tiltmeter", label: "تیلت‌متر مجتمع تجاری", location: "مجتمع تجاری شمال شرق", baseline: 0, threshold: { warning: 1.2, alarm: 2.4 }, pos: { x: 88, y: 18 }, drift: 1.4, noise: 0.09, trend: "step", days: 90, seed: 331 },
    { code: "TM-02", type: "tiltmeter", label: "تیلت‌متر عمارت قدیمی", location: "عمارت قدیمی جنوب", baseline: 0, threshold: { warning: 1.2, alarm: 2.4 }, pos: { x: 12, y: 85 }, drift: 0.5, noise: 0.06, trend: "linear", days: 90, seed: 332 },
    { code: "TM-03", type: "tiltmeter", label: "تیلت‌متر سفارتخانه", location: "سفارتخانه غرب", baseline: 0, threshold: { warning: 1.2, alarm: 2.4 }, pos: { x: 8, y: 50 }, drift: 0.3, noise: 0.05, trend: "linear", days: 90, seed: 333 },
    { code: "OW-01", type: "observation_well", label: "چاه مشاهده‌ای شمال", location: "تراز آب زیرزمینی شمال", baseline: 14.0, threshold: { warning: 2, alarm: 4 }, pos: { x: 35, y: 22 }, drift: 1.0, noise: 0.12, trend: "seasonal", days: 90, seed: 341 },
    { code: "OW-02", type: "observation_well", label: "چاه مشاهده‌ای جنوب", location: "تراز آب زیرزمینی جنوب", baseline: 13.9, threshold: { warning: 2, alarm: 4 }, pos: { x: 65, y: 78 }, drift: 0.5, noise: 0.1, trend: "seasonal", days: 90, seed: 342 },
    { code: "JM-01", type: "jointmeter", label: "درزسنج درز 1", location: "درز سازه مجاور شمال", baseline: 0, threshold: { warning: 2, alarm: 4 }, pos: { x: 58, y: 22 }, drift: 1.8, noise: 0.12, trend: "linear", days: 90, seed: 351 },
    { code: "JM-02", type: "jointmeter", label: "درزسنج درز 2", location: "درز سازه مجاور جنوب", baseline: 0, threshold: { warning: 2, alarm: 4 }, pos: { x: 42, y: 78 }, drift: 0.9, noise: 0.09, trend: "linear", days: 90, seed: 352 },
  ],

  // === بسیج (R3) — last station, normal status ===
  "st-r3": [
    { code: "EX-01", type: "extensometer", label: "اکستنسومتر شمالی", location: "خاک شمال سازه - عمق 10m", baseline: 0, threshold: { warning: 5, alarm: 10 }, pos: { x: 50, y: 30 }, drift: 1.5, noise: 0.3, trend: "linear", days: 90, seed: 411 },
    { code: "EX-02", type: "extensometer", label: "اکستنسومتر جنوبی", location: "خاک جنوب سازه - عمق 10m", baseline: 0, threshold: { warning: 5, alarm: 10 }, pos: { x: 50, y: 70 }, drift: 1.1, noise: 0.28, trend: "linear", days: 90, seed: 412 },
    { code: "EX-03", type: "extensometer", label: "اکستنسومتر شرقی", location: "خاک شرق سازه - عمق 12m", baseline: 0, threshold: { warning: 5, alarm: 10 }, pos: { x: 70, y: 50 }, drift: 0.6, noise: 0.22, trend: "linear", days: 90, seed: 413 },
    { code: "INC-01", type: "inclinometer", label: "اینکلاینومتر A", location: "شمال شرق - عمق 18m", baseline: 0, threshold: { warning: 12, alarm: 22 }, pos: { x: 75, y: 25 }, drift: 3.5, noise: 0.5, trend: "linear", days: 90, seed: 421 },
    { code: "INC-02", type: "inclinometer", label: "اینکلاینومتر B", location: "جنوب غرب - عمق 18m", baseline: 0, threshold: { warning: 12, alarm: 22 }, pos: { x: 25, y: 75 }, drift: 2.1, noise: 0.4, trend: "linear", days: 90, seed: 422 },
    { code: "TM-01", type: "tiltmeter", label: "تیلت‌متر ساختمان اداری", location: "ساختمان اداری شمال شرق", baseline: 0, threshold: { warning: 1.2, alarm: 2.4 }, pos: { x: 88, y: 18 }, drift: 0.22, noise: 0.05, trend: "linear", days: 90, seed: 431 },
    { code: "TM-02", type: "tiltmeter", label: "تیلت‌متر مسجد جامع", location: "مسجد جامع جنوب", baseline: 0, threshold: { warning: 1.2, alarm: 2.4 }, pos: { x: 12, y: 85 }, drift: 0.18, noise: 0.05, trend: "linear", days: 90, seed: 432 },
    { code: "OW-01", type: "observation_well", label: "چاه مشاهده‌ای شمال", location: "تراز آب زیرزمینی شمال", baseline: 15.6, threshold: { warning: 2, alarm: 4 }, pos: { x: 35, y: 22 }, drift: 0.3, noise: 0.08, trend: "seasonal", days: 90, seed: 441 },
    { code: "OW-02", type: "observation_well", label: "چاه مشاهده‌ای جنوب", location: "تراز آب زیرزمینی جنوب", baseline: 15.4, threshold: { warning: 2, alarm: 4 }, pos: { x: 65, y: 78 }, drift: 0.2, noise: 0.08, trend: "seasonal", days: 90, seed: 442 },
    { code: "JM-01", type: "jointmeter", label: "درزسنج درز 1", location: "درز سازه مجاور شمال", baseline: 0, threshold: { warning: 2, alarm: 4 }, pos: { x: 58, y: 22 }, drift: 0.4, noise: 0.08, trend: "linear", days: 90, seed: 451 },
    { code: "JM-02", type: "jointmeter", label: "درزسنج درز 2", location: "درز سازه مجاور جنوب", baseline: 0, threshold: { warning: 2, alarm: 4 }, pos: { x: 42, y: 78 }, drift: 0.3, noise: 0.07, trend: "linear", days: 90, seed: 452 },
    { code: "JM-03", type: "jointmeter", label: "درزسنج درز 3", location: "درز سازه مجاور شرق", baseline: 0, threshold: { warning: 2, alarm: 4 }, pos: { x: 80, y: 50 }, drift: 0.15, noise: 0.06, trend: "linear", days: 90, seed: 453 },
  ],
};

const INSTRUMENTS_CACHE: Record<string, Instrument[]> = {};

export function getInstrumentsForStation(stationId: string): Instrument[] {
  if (INSTRUMENTS_CACHE[stationId]) return INSTRUMENTS_CACHE[stationId];

  const seeds = STATION_LAYOUT[stationId] || [];
  const instruments: Instrument[] = seeds.map((s) => {
    const readings = genSeries(s.seed, s.days, s.baseline, s.drift, s.noise, s.trend);
    const last = readings[readings.length - 1];
    const delta = s.type === "observation_well"
      ? last.value - s.baseline
      : last.value - s.baseline; // signed delta from baseline
    const deltaAbs = Math.abs(delta);
    const status = statusFromDelta(deltaAbs, s.threshold);
    const meta = INSTRUMENT_TYPES[s.type];
    return {
      id: `${stationId}-${s.code}`,
      code: s.code,
      type: s.type,
      stationId,
      label: s.label,
      location: s.location,
      unit: meta.unit,
      baseline: s.baseline,
      threshold: s.threshold,
      pos: s.pos,
      readings,
      status,
      lastReading: last.value,
      lastDelta: Number(delta.toFixed(4)),
      updatedAt: last.t,
    };
  });

  INSTRUMENTS_CACHE[stationId] = instruments;
  return instruments;
}

export interface AlertItem {
  id: string;
  instrumentCode: string;
  instrumentLabel: string;
  stationId: string;
  stationName: string;
  type: InstrumentType;
  status: InstrumentStatus;
  value: number;
  unit: string;
  threshold: number;
  message: string;
  time: number;
}

export function getAlerts(): AlertItem[] {
  const out: AlertItem[] = [];
  for (const st of STATIONS) {
    const list = getInstrumentsForStation(st.id);
    for (const ins of list) {
      if (ins.status === "alarm" || ins.status === "warning") {
        const th = ins.status === "alarm" ? ins.threshold.alarm : ins.threshold.warning;
        out.push({
          id: ins.id,
          instrumentCode: ins.code,
          instrumentLabel: ins.label,
          stationId: st.id,
          stationName: st.name,
          type: ins.type,
          status: ins.status,
          value: ins.lastReading,
          unit: ins.unit,
          threshold: th,
          message:
            ins.status === "alarm"
              ? `مقدار اندازه‌گیری شده از حد آلارم (${th} ${ins.unit}) فراتر رفته است`
              : `مقدار اندازه‌گیری شده از حد هشدار (${th} ${ins.unit}) فراتر رفته است`,
          time: ins.updatedAt,
        });
      }
    }
  }
  // sort by severity then time
  const sev: Record<InstrumentStatus, number> = { alarm: 0, warning: 1, offline: 2, normal: 3 };
  out.sort((a, b) => sev[a.status] - sev[b.status] || b.time - a.time);
  return out;
}

// helpers
export function fmtDateFa(ts: number): string {
  // Persian (jalali) display via Intl with calendar
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toISOString().slice(0, 10);
  }
}

export function fmtDateTimeFa(ts: number): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toISOString();
  }
}

export function fmtNum(n: number, digits = 2): string {
  // thousands separator in Persian locale
  try {
    return new Intl.NumberFormat("fa-IR", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(n);
  } catch {
    return n.toFixed(digits);
  }
}

export function fmtNumEn(n: number, digits = 2): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export const NOW_TS = NOW;

// Compute station list with derived fields (status, instrumentCount, alertCount)
// from the actual instrument data. This guarantees that the station-level
// indicators stay consistent with the per-instrument readings.
function computeStation(def: StationDef): Station {
  const instruments = getInstrumentsForStation(def.id);
  const alarmCount = instruments.filter((i) => i.status === "alarm").length;
  const warnCount = instruments.filter((i) => i.status === "warning").length;
  const alertCount = alarmCount + warnCount;
  const status: InstrumentStatus =
    alarmCount > 0 ? "alarm" : warnCount > 0 ? "warning" : "normal";
  return {
    id: def.id,
    name: def.name,
    code: def.code,
    status,
    instrumentCount: instruments.length,
    alertCount,
  };
}

export const STATIONS: Station[] = STATION_DEFS.map(computeStation);
