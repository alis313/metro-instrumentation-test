import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";

export interface ExcelReading {
  t: number;
  value: number;
}

export interface ExcelSeries {
  label: string;
  color: string;
  readings: ExcelReading[];
}

export interface ExcelInstrumentData {
  code: string;
  label: string;
  readings: ExcelReading[];
  series: ExcelSeries[];
}

export interface ExcelStationData {
  stationId: string;
  extensometers: ExcelInstrumentData[];
  crackmeters: ExcelInstrumentData[];
  observationWells: ExcelInstrumentData[];
  tiltmeters: ExcelInstrumentData[];
}

// ─── Column indices ──────────────────────────────────────────────────
// Extensometer columns
const COL_EXT_DATE = 2;
const EXT_DEPTH_COLUMNS: Array<{ col: number; label: string; color: string }> = [
  { col: 24, label: "نشست سطحی",  color: "#7c3aed" },
  { col: 25, label: "عمق 36.5m",  color: "#0d7d6c" },
  { col: 26, label: "عمق 30.5m",  color: "#b45309" },
  { col: 27, label: "عمق 24.5m",  color: "#15803d" },
  { col: 28, label: "عمق 12.5m",  color: "#c2410c" },
  { col: 29, label: "عمق 5.5m",   color: "#6b7280" },
];

// Crackmeter colors
const CRACKMETER_COLORS = ["#0d7d6c", "#b45309", "#15803d", "#c2410c"];

// Tiltmeter colors
const TILTMETER_COLORS_A = "#0d7d6c";
const TILTMETER_COLORS_B = "#b45309";

// Well color
const WELL_COLOR = "#7c3aed";

const HEADER_ROWS_EXT = 2;

// Thresholds
const EXT_THRESHOLD = { warning: 15, alarm: 30 };
const CRACK_THRESHOLD = { warning: 2, alarm: 4 };
const WELL_THRESHOLD = { warning: 50, alarm: 100 }; // cm
const TILT_THRESHOLD = { warning: 0.5, alarm: 1.0 }; // degrees

let cachedData: ExcelStationData | null = null;
let cacheError: string | null = null;

// ─── Helper functions ────────────────────────────────────────────────

function parseDate(val: unknown): number | null {
  if (val === null || val === undefined || val === "*") return null;
  if (val instanceof Date) {
    const t = val.getTime();
    return isNaN(t) ? null : t;
  }
  if (typeof val === "number") {
    if (val > 25569) return Math.round((val - 25569) * 86400000);
    return null;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed || trimmed === "*") return null;
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.getTime();
    const isoStr = trimmed.replace(/\//g, "-");
    const d2 = new Date(isoStr);
    if (!isNaN(d2.getTime())) return d2.getTime();
  }
  return null;
}

function parseNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const s = val.trim();
    if (s === "*" || s === "" || s === "#VALUE!" || s.startsWith("#")) return null;
    const n = parseFloat(s);
    if (!isNaN(n)) return n;
  }
  return null;
}

function isDataRow(row: unknown[], dateCol: number): boolean {
  const dateVal = row[dateCol];
  if (dateVal === null || dateVal === undefined || dateVal === "*") return false;
  if (dateVal instanceof Date) return !isNaN(dateVal.getTime());
  if (typeof dateVal === "number") return dateVal > 25569;
  if (typeof dateVal === "string") {
    const s = dateVal.trim();
    return s !== "" && s !== "*" && !s.startsWith("#");
  }
  return false;
}

function sampleReadings(
  readings: ExcelReading[],
  maxPoints: number
): ExcelReading[] {
  if (readings.length <= maxPoints) return readings;
  const step = Math.floor(readings.length / maxPoints);
  const sampled: ExcelReading[] = [];
  sampled.push(readings[0]);
  for (let i = step; i < readings.length - 1; i += step) {
    sampled.push(readings[i]);
  }
  sampled.push(readings[readings.length - 1]);
  return sampled;
}

// ─── Extensometer parser (dynamic column detection) ─────────────────

function parseExtensometerSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string
): ExcelInstrumentData | null {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });

  // Find the header row: the one containing "Date" or "Movement" or depth labels like "27.5m"
  let headerRowIdx = -1;
  let dateCol = -1;
  const depthRe = /^\s*\d+([.,]\d+)?\s*m\s*$/i;
  for (let r = 0; r < Math.min(8, rows.length); r++) {
    const row = rows[r] || [];
    const rowStr = row.map((c) => String(c ?? "").toLowerCase());
    if (rowStr.some((s) => s === "date" || s === "data")) {
      headerRowIdx = r;
      for (let c = 0; c < row.length; c++) {
        const v = String(row[c] ?? "").trim().toLowerCase();
        if (v === "date" || v === "data") { dateCol = c; break; }
      }
      break;
    }
    // Fallback: row has Movement + depth labels
    if (rowStr.some((s) => s.includes("movement")) &&
        row.some((c) => depthRe.test(String(c ?? "")))) {
      headerRowIdx = r;
      for (let c = 0; c < row.length; c++) {
        const v = String(row[c] ?? "").trim().toLowerCase();
        if (v === "date" || v === "data") { dateCol = c; break; }
      }
      if (dateCol === -1) {
        // Date might be col 0 or 1
        dateCol = String(row[0] ?? "").toLowerCase().startsWith("no") ? 1 : 0;
      }
      break;
    }
  }

  if (headerRowIdx === -1 || dateCol === -1) {
    // Ultimate fallback: old hardcoded positions (Link layout)
    headerRowIdx = HEADER_ROWS_EXT;
    dateCol = COL_EXT_DATE;
  }

  const headerRow = rows[headerRowIdx] || [];

  // Find all depth-labelled columns (e.g. "27.5 m", "19.5m", "5.5 m")
  const depthCols: Array<{ col: number; label: string; color: string }> = [];
  for (let c = 0; c < headerRow.length; c++) {
    const h = String(headerRow[c] ?? "").trim();
    if (depthRe.test(h)) {
      const label = `عمق ${h.replace(/\s+/g, "")}`;
      depthCols.push({
        col: c,
        label,
        color: EXT_DEPTH_COLUMNS[depthCols.length % EXT_DEPTH_COLUMNS.length].color,
      });
    }
  }

  // Also look for an explicit "Movement" column to include as the surface settlement series
  let movementCol = -1;
  for (let c = 0; c < headerRow.length; c++) {
    const h = String(headerRow[c] ?? "").trim().toLowerCase();
    if (h === "movement") {
      movementCol = c;
      break;
    }
  }

  // If no depth columns found AND no movement column, fall back to hardcoded positions
  if (depthCols.length === 0 && movementCol === -1) {
    for (const dc of EXT_DEPTH_COLUMNS) {
      depthCols.push({ ...dc });
    }
    movementCol = 25; // Link's "Movement" col
  }

  // Build series for each depth column
  const depthReadings: ExcelReading[][] = depthCols.map(() => []);
  const movementReadings: ExcelReading[] = [];

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !isDataRow(row, dateCol)) continue;
    const t = parseDate(row[dateCol]);
    if (t === null) continue;

    for (let d = 0; d < depthCols.length; d++) {
      const value = parseNumber(row[depthCols[d].col]);
      if (value !== null) {
        depthReadings[d].push({ t, value: Number(value.toFixed(4)) });
      }
    }
    if (movementCol >= 0) {
      const mv = parseNumber(row[movementCol]);
      if (mv !== null) movementReadings.push({ t, value: Number(mv.toFixed(4)) });
    }
  }

  const series: ExcelSeries[] = [];
  let primaryReadings: ExcelReading[] = [];

  // Surface settlement (Movement column) first if present
  if (movementReadings.length > 0) {
    const sampled = sampleReadings(movementReadings, 100);
    series.push({
      label: "نشست سطحی",
      color: EXT_DEPTH_COLUMNS[0].color,
      readings: sampled,
    });
    primaryReadings = sampled;
  }

  for (let d = 0; d < depthCols.length; d++) {
    if (depthReadings[d].length === 0) continue;
    const sampled = sampleReadings(depthReadings[d], 100);
    series.push({
      label: depthCols[d].label,
      color: depthCols[d].color,
      readings: sampled,
    });
    if (primaryReadings.length === 0) primaryReadings = sampled;
  }

  if (series.length === 0) return null;

  return {
    code: sheetName,
    label: `اکستنسومتر ${sheetName}`,
    readings: primaryReadings,
    series,
  };
}

// ─── Crackmeter parser ───────────────────────────────────────────────

function parseCrackmeterSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string
): ExcelInstrumentData | null {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });

  // Find the header row: first row containing "Date" or "Data" or "NO."
  let headerRowIdx = 1;
  let dateCol = 1;
  for (let r = 0; r < Math.min(6, rows.length); r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const v = String(row[c] ?? "").trim().toLowerCase();
      if (v === "date" || v === "data" || v === "date2") {
        headerRowIdx = r;
        dateCol = c;
        break;
      }
    }
    if (headerRowIdx !== 1 || dateCol !== 1) break;
  }
  const headerRow = rows[headerRowIdx] || [];
  const dataStartRow = headerRowIdx + 1;

  // Find all "Difference*" columns and their preceding reading column labels
  const diffCols: Array<{ col: number; label: string }> = [];
  for (let c = 0; c < headerRow.length; c++) {
    const h = String(headerRow[c] ?? "").trim();
    if (h.toLowerCase().startsWith("difference")) {
      // Find the reading column label (preceding non-empty header)
      let label = `نقطه ${diffCols.length + 1}`;
      for (let back = c - 1; back >= 0; back--) {
        const pv = String(headerRow[back] ?? "").trim();
        if (pv && !pv.toLowerCase().startsWith("difference")) {
          label = pv;
          break;
        }
      }
      diffCols.push({ col: c, label });
    }
  }

  // If no Difference columns found, fall back to every-other-column heuristic
  if (diffCols.length === 0) {
    for (let c = dateCol + 2; c < headerRow.length; c += 2) {
      diffCols.push({ col: c, label: `نقطه ${diffCols.length + 1}` });
    }
  }

  if (diffCols.length === 0) return null;

  const series: ExcelSeries[] = [];
  for (let i = 0; i < diffCols.length; i++) {
    const { col, label } = diffCols[i];
    const readings: ExcelReading[] = [];
    for (let r = dataStartRow; r < rows.length; r++) {
      const row = rows[r];
      if (!row || !isDataRow(row, dateCol)) continue;
      const t = parseDate(row[dateCol]);
      if (t === null) continue;
      const diff = parseNumber(row[col]);
      if (diff !== null) {
        readings.push({ t, value: Number(diff.toFixed(4)) });
      }
    }
    if (readings.length > 0) {
      series.push({
        label,
        color: CRACKMETER_COLORS[i % CRACKMETER_COLORS.length],
        readings: sampleReadings(readings, 100),
      });
    }
  }

  if (series.length === 0) return null;

  return {
    code: sheetName,
    label: sheetName,
    readings: series[0].readings,
    series,
  };
}

// ─── Observation well parser ─────────────────────────────────────────

function parseWellSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string
): ExcelInstrumentData | null {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });

  // Structure: metadata rows 0-4, header row 5, data row 6+
  // Col 0: Date, Col 2: تراز سطح آب(m), Col 3: تغییرات تراز(cm)

  const depthReadings: ExcelReading[] = [];
  const levelReadings: ExcelReading[] = [];
  const changeReadings: ExcelReading[] = [];

  for (let i = 6; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !isDataRow(row, 0)) continue;
    const t = parseDate(row[0]);
    if (t === null) continue;

    const depth = parseNumber(row[1]); // عمق سطح آب (m)
    if (depth !== null) {
      depthReadings.push({ t, value: Number(depth.toFixed(4)) });
    }

    const level = parseNumber(row[2]); // تراز سطح آب (m)
    if (level !== null) {
      levelReadings.push({ t, value: Number(level.toFixed(4)) });
    }

    const change = parseNumber(row[3]); // تغییرات تراز (cm)
    if (change !== null) {
      changeReadings.push({ t, value: Number(change.toFixed(4)) });
    }
  }

  if (depthReadings.length === 0 && levelReadings.length === 0) return null;

  const sampledDepth = sampleReadings(depthReadings, 100);

  // Show water depth (عمق سطح آب) as the primary series
  const series: ExcelSeries[] = [];
  if (sampledDepth.length > 0) {
    series.push({
      label: "عمق سطح آب (m)",
      color: WELL_COLOR,
      readings: sampledDepth,
    });
  }

  return {
    code: sheetName,
    label: `چاه مشاهده‌ای ${sheetName}`,
    readings: sampledDepth,
    series,
  };
}

// ─── Tiltmeter parser ────────────────────────────────────────────────

function parseTiltmeterSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string
): ExcelInstrumentData[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });

  // Find header row by scanning for "A Axis" / "B Axis" / "Date"
  let headerRowIdx = -1;
  let dateCol = 1;
  for (let r = 0; r < Math.min(8, rows.length); r++) {
    const row = rows[r] || [];
    const joined = row.map((c) => String(c ?? "").toLowerCase()).join("|");
    if (joined.includes("a axis") || joined.includes("b axis")) {
      headerRowIdx = r;
      // find Date column in this row or one above
      for (let rr = r; rr >= Math.max(0, r - 2); rr--) {
        const rrrow = rows[rr] || [];
        for (let c = 0; c < rrrow.length; c++) {
          const v = String(rrrow[c] ?? "").trim().toLowerCase();
          if (v === "date" || v === "data" || v === "date2") {
            dateCol = c;
            break;
          }
        }
      }
      break;
    }
  }
  if (headerRowIdx === -1) {
    // Fallback to old hardcoded layout
    headerRowIdx = 5;
    dateCol = 1;
  }

  // Find the actual data-start row
  let dataStart = headerRowIdx + 1;
  for (let r = headerRowIdx + 1; r < Math.min(headerRowIdx + 8, rows.length); r++) {
    const row = rows[r] || [];
    if (isDataRow(row, dateCol)) {
      dataStart = r;
      break;
    }
  }

  const headerRow = rows[headerRowIdx] || [];

  // Find all "A Axis" / "B Axis" pairs and infer diff column positions
  const tmBlocks: Array<{ name: string; colA: number; colB: number }> = [];
  for (let c = 0; c < headerRow.length; c++) {
    const h = String(headerRow[c] ?? "").trim().toLowerCase();
    if (h === "a axis" || h.startsWith("a axis")) {
      let bCol = -1;
      for (let cc = c + 1; cc < headerRow.length; cc++) {
        const hh = String(headerRow[cc] ?? "").trim().toLowerCase();
        if (hh === "b axis" || hh.startsWith("b axis")) {
          bCol = cc;
          break;
        }
      }
      if (bCol > c) {
        // Diff columns are typically 1-2 cols to the right of axis labels
        let colA = c + 1;
        let colB = bCol + 1;
        const tryHasData = (col: number) => {
          let cnt = 0;
          for (let r = dataStart; r < Math.min(dataStart + 10, rows.length); r++) {
            const row = rows[r];
            if (!row) continue;
            const v = row[col];
            if (typeof v === "number" && !isNaN(v)) cnt++;
          }
          return cnt > 3;
        };
        if (!tryHasData(colA)) colA = c + 2;
        if (!tryHasData(colB)) colB = bCol + 2;
        tmBlocks.push({
          name: `تیلت‌متر ${tmBlocks.length + 1}`,
          colA,
          colB,
        });
      }
    }
  }

  // Fallback: if no blocks detected, use old hardcoded positions
  if (tmBlocks.length === 0) {
    tmBlocks.push({ name: "تیلت‌متر ۱", colA: 5, colB: 7 });
    tmBlocks.push({ name: "تیلت‌متر ۲", colA: 11, colB: 13 });
  }

  const tiltmeters: ExcelInstrumentData[] = [];

  for (const cfg of tmBlocks) {
    const series: ExcelSeries[] = [];

    for (const [axis, col, color] of [
      ["A", cfg.colA, TILTMETER_COLORS_A],
      ["B", cfg.colB, TILTMETER_COLORS_B],
    ] as const) {
      const readings: ExcelReading[] = [];
      for (let i = dataStart; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !isDataRow(row, dateCol)) continue;
        const t = parseDate(row[dateCol]);
        if (t === null) continue;
        const diff = parseNumber(row[col]);
        if (diff !== null) {
          readings.push({ t, value: Number(diff.toFixed(6)) });
        }
      }
      if (readings.length > 0) {
        series.push({
          label: `محور ${axis}`,
          color,
          readings: sampleReadings(readings, 100),
        });
      }
    }

    if (series.length > 0) {
      tiltmeters.push({
        code: `TM-${sheetName}-${cfg.name}`,
        label: `${cfg.name} (${sheetName})`,
        readings: series[0].readings,
        series,
      });
    }
  }

  return tiltmeters;
}

// ─── Sheet type detection (structure-based, not name-based) ─────────

type SheetType = "extensometer" | "crackmeter" | "well" | "tiltmeter" | "skip";

function detectSheetType(
  sheetName: string,
  sheet: XLSX.WorkSheet
): SheetType {
  const lower = sheetName.toLowerCase().trim();

  // Always skip chart / blank sheets
  if (lower.startsWith("chart") || /^sheet\d*$/.test(lower)) return "skip";

  // Read first 4 rows to inspect structure
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1, raw: true, defval: null,
  });
  const row0 = (rows[0] || []).map((c) => String(c ?? ""));
  const row1 = (rows[1] || []).map((c) => String(c ?? ""));
  const row2 = (rows[2] || []).map((c) => String(c ?? ""));
  const row3 = (rows[3] || []).map((c) => String(c ?? ""));

  const allHeaderText = [...row0, ...row1, ...row2, ...row3].join(" ").toLowerCase();

  // Tiltmeter: "A Axis" / "B Axis" in row 1, or title contains "تیلت"
  if (
    row1.some((c) => c.toLowerCase().includes("a axis")) ||
    row1.some((c) => c.toLowerCase().includes("b axis")) ||
    row0.some((c) => c.includes("تیلت")) ||
    sheetName.includes("تیلت")
  ) {
    return "tiltmeter";
  }

  // Well: name starts with چاه, or has X/Y/Z coordinate rows + "Depth"
  if (
    sheetName.startsWith("چاه") ||
    (row1.some((c) => c.toLowerCase() === "x") &&
     row2.some((c) => c.toLowerCase() === "y") &&
     row3.some((c) => c.toLowerCase() === "depth")) ||
    sheetName.toLowerCase() === "w" ||
    allHeaderText.includes("تراز سطح آب")
  ) {
    return "well";
  }

  // Extensometer: name starts with EX, or has "Movement(mm)" + depth labels
  if (/^ex/i.test(sheetName)) return "extensometer";
  if (
    allHeaderText.includes("movement") &&
    (allHeaderText.includes("m long rod") ||
     row2.some((c) => /^\s*\d+([.,]\d+)?\s*m\s*$/i.test(c)))
  ) {
    return "extensometer";
  }

  // Crackmeter: has "Difference" columns + "CM" or "TB" or "TG" or "TM" reading columns
  const hasDiffCol = row1.some((c) => c.toLowerCase().startsWith("difference"));
  const hasReadingCol = row1.some((c) =>
    /^(cm|tb|tg|tm|jm|sm|cm\d+)\s*\(mm\)/i.test(c.trim()) ||
    c.toLowerCase().endsWith("(mm)")
  );
  if (hasDiffCol && hasReadingCol) return "crackmeter";

  // Fallback: if it has "Date" header + numeric columns, treat as crackmeter
  if (row1.some((c) => c.toLowerCase() === "date" || c.toLowerCase() === "data")) {
    return "crackmeter";
  }

  return "skip";
}

// ─── Main parser ─────────────────────────────────────────────────────

function parseExcelFile(filePath: string): ExcelStationData {
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

  const extensometers: ExcelInstrumentData[] = [];
  const crackmeters: ExcelInstrumentData[] = [];
  const observationWells: ExcelInstrumentData[] = [];
  const tiltmeters: ExcelInstrumentData[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const t = detectSheetType(sheetName, sheet);
    if (t === "skip") continue;

    try {
      if (t === "extensometer") {
        const result = parseExtensometerSheet(sheet, sheetName);
        if (result) extensometers.push(result);
      } else if (t === "crackmeter") {
        const result = parseCrackmeterSheet(sheet, sheetName);
        if (result) crackmeters.push(result);
      } else if (t === "well") {
        const result = parseWellSheet(sheet, sheetName);
        if (result) observationWells.push(result);
      } else if (t === "tiltmeter") {
        const results = parseTiltmeterSheet(sheet, sheetName);
        tiltmeters.push(...results);
      }
    } catch (err) {
      console.warn(`[excel-reader] Failed to parse sheet ${sheetName}:`, err);
    }
  }

  const total = extensometers.length + crackmeters.length + observationWells.length + tiltmeters.length;
  console.log(
    `[excel-reader] Parsed: ${extensometers.length} extensometers, ${crackmeters.length} crackmeters, ${observationWells.length} wells, ${tiltmeters.length} tiltmeters (${total} total)`
  );

  return {
    stationId: "st-link",
    extensometers,
    crackmeters,
    observationWells,
    tiltmeters,
  };
}

// ─── Multi-station registry ──────────────────────────────────────────
// Maps dashboard stationId -> source Excel filename in /upload
export const STATION_FILES: Record<string, string> = {
  "st-link": "Data Instrumentation-Link.xls",
  "st-n3":   "Data Instrumentation-N3.xls",
  "st-o3":   "Data Instrumentation-O3.xls",
  "st-p3":   "Data Instrumentation-P3.xls",
  "st-q3":   "Data Instrumentation-Q3.xls",
  "st-r3":   "Data Instrumentation-R3.xls",
};

// Per-station cache
const STATION_CACHE: Record<string, ExcelStationData | null> = {};
const STATION_ERROR: Record<string, string | null> = {};

export function getExcelDataForStation(stationId: string): ExcelStationData | null {
  if (stationId in STATION_CACHE) return STATION_CACHE[stationId];
  if (STATION_ERROR[stationId]) return null;

  const fname = STATION_FILES[stationId];
  if (!fname) {
    STATION_ERROR[stationId] = `No file mapping for station ${stationId}`;
    return null;
  }
  const filePath = path.join(process.cwd(), "upload", fname);
  if (!fs.existsSync(filePath)) {
    STATION_ERROR[stationId] = `File not found: ${filePath}`;
    console.warn(`[excel-reader] ${STATION_ERROR[stationId]}`);
    STATION_CACHE[stationId] = null;
    return null;
  }
  try {
    const parsed = parseExcelFile(filePath);
    parsed.stationId = stationId; // override default st-link
    STATION_CACHE[stationId] = parsed;
    console.log(`[excel-reader] Loaded station ${stationId} from ${fname}`);
    return parsed;
  } catch (err) {
    STATION_ERROR[stationId] = String(err);
    console.error(`[excel-reader] Error parsing ${fname}:`, err);
    STATION_CACHE[stationId] = null;
    return null;
  }
}

// Returns Excel data for ALL stations, keyed by stationId
export function getAllExcelData(): Record<string, ExcelStationData> {
  const out: Record<string, ExcelStationData> = {};
  for (const stationId of Object.keys(STATION_FILES)) {
    const d = getExcelDataForStation(stationId);
    if (d) out[stationId] = d;
  }
  return out;
}

// Backward-compatible single-station loader (still returns Link data)
export function getExcelData(): ExcelStationData | null {
  if (cachedData) return cachedData;
  if (cacheError) return null;
  const d = getExcelDataForStation("st-link");
  cachedData = d;
  if (!d) cacheError = "No Link data";
  return d;
}

// Export thresholds for each instrument type
export function getThresholds() {
  return {
    extensometer: EXT_THRESHOLD,
    crackmeter: CRACK_THRESHOLD,
    observationWell: WELL_THRESHOLD,
    tiltmeter: TILT_THRESHOLD,
  };
}
