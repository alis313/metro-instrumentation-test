// Configurable Excel parser: reads SheetConfig rows from the DB and parses accordingly.
// Supports both local filesystem (dev) and Vercel Blob URLs (production) via file-storage layer.
import * as XLSX from "xlsx";
import { db } from "./db";
import { readFile } from "./file-storage";

export interface ReadingPoint { t: number; value: number; }
export interface InstrumentSeries {
  label: string;
  color: string;
  readings: ReadingPoint[];
}
export interface InstrumentData {
  code: string;
  label: string;
  type: string;
  sheetName: string;
  readings: ReadingPoint[];
  series: InstrumentSeries[];
  dateStart?: number;
  dateEnd?: number;
}

// Convert an Excel cell value to an epoch-ms timestamp
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

function sampleReadings(readings: ReadingPoint[], maxPoints: number): ReadingPoint[] {
  if (readings.length <= maxPoints) return readings;
  const step = Math.floor(readings.length / maxPoints);
  const sampled: ReadingPoint[] = [readings[0]];
  for (let i = step; i < readings.length - 1; i += step) sampled.push(readings[i]);
  sampled.push(readings[readings.length - 1]);
  return sampled;
}

const DEFAULT_COLORS = ["#0d7d6c", "#b45309", "#15803d", "#c2410c", "#7c3aed", "#6b7280"];

// ─── Analyze a sheet's structure (for the admin UI) ──────────────────

export interface SheetAnalysis {
  sheetName: string;
  totalRows: number;
  totalCols: number;
  headerRowCandidates: number[]; // row indices that look like headers
  detectedHeaderRow: number;
  detectedDateCol: number;
  headerCells: string[]; // the cells of the detected header row
  numericCols: Array<{ col: number; sample: number | null }>;
  dateCols: Array<{ col: number; sample: number | null }>;
  previewRows: unknown[][]; // first 5 data rows
  suggestedInstrumentType: string;
}

export function analyzeSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string
): SheetAnalysis {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1, raw: true, defval: null,
  });

  // Find header row: first row containing "Date" / "Data" / "No."
  let headerRow = 1;
  let dateCol = 1;
  for (let r = 0; r < Math.min(8, rows.length); r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const v = String(row[c] ?? "").trim().toLowerCase();
      if (v === "date" || v === "data" || v === "date2") {
        headerRow = r;
        dateCol = c;
        break;
      }
    }
    if (headerRow !== 1 || dateCol !== 1) break;
  }

  const headerCells = (rows[headerRow] || []).map((c) => String(c ?? ""));

  // Classify columns by sample values
  const numericCols: Array<{ col: number; sample: number | null }> = [];
  const dateCols: Array<{ col: number; sample: number | null }> = [];
  const previewRows: unknown[][] = [];

  for (let c = 0; c < headerCells.length; c++) {
    let numericCount = 0;
    let dateCount = 0;
    let sampleNum: number | null = null;
    let sampleDate: number | null = null;
    for (let r = headerRow + 1; r < Math.min(headerRow + 15, rows.length); r++) {
      const row = rows[r] || [];
      const v = row[c];
      if (typeof v === "number") {
        if (v > 30000 && v < 70000) {
          dateCount++;
          if (sampleDate === null) sampleDate = v;
        } else {
          numericCount++;
          if (sampleNum === null) sampleNum = v;
        }
      }
    }
    if (numericCount > 3) numericCols.push({ col: c, sample: sampleNum });
    if (dateCount > 3) dateCols.push({ col: c, sample: sampleDate });
  }

  // First 5 data rows
  for (let r = headerRow + 1; r < Math.min(headerRow + 6, rows.length); r++) {
    previewRows.push((rows[r] || []).slice(0, Math.min(headerCells.length, 20)));
  }

  // Suggest instrument type
  const headerText = headerCells.join(" ").toLowerCase();
  let suggestedType = "OTHER";
  if (/^ex/i.test(sheetName) || headerText.includes("movement")) suggestedType = "EXTENSOMETER";
  else if (sheetName.startsWith("چاه") || headerText.includes("depth")) suggestedType = "OBSERVATION_WELL";
  else if (headerText.includes("a axis") || headerText.includes("b axis")) suggestedType = "TILTMETER";
  else if (headerText.includes("difference")) suggestedType = "CRACKMETER";

  return {
    sheetName,
    totalRows: rows.length,
    totalCols: headerCells.length,
    headerRowCandidates: [0, 1, 2, 3].filter((r) => r < rows.length),
    detectedHeaderRow: headerRow,
    detectedDateCol: dateCol,
    headerCells,
    numericCols,
    dateCols,
    previewRows,
    suggestedInstrumentType: suggestedType,
  };
}

// ─── Parse a single sheet according to its SheetConfig ───────────────

export async function parseSheetWithConfig(
  filePath: string,
  cfg: {
    sheetName: string;
    instrumentType: string;
    instrumentCode: string | null;
    instrumentLabel: string | null;
    headerRow: number;
    dateCol: number;
    valueCols: string; // JSON array of {col, label, color}
    dateRangeStart: string | null;
    dateRangeEnd: string | null;
  }
): Promise<InstrumentData | null> {
  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    return null;
  }
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[cfg.sheetName];
  if (!sheet) return null;

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1, raw: true, defval: null,
  });

  let valueCols: Array<{ col: number; label: string; color: string }> = [];
  try {
    valueCols = JSON.parse(cfg.valueCols);
  } catch {
    valueCols = [];
  }
  if (!Array.isArray(valueCols) || valueCols.length === 0) return null;

  const rangeStart = cfg.dateRangeStart ? new Date(cfg.dateRangeStart).getTime() : null;
  const rangeEnd = cfg.dateRangeEnd ? new Date(cfg.dateRangeEnd).getTime() : null;

  const seriesReadings: ReadingPoint[][] = valueCols.map(() => []);
  let firstTs: number | null = null;
  let lastTs: number | null = null;

  for (let i = cfg.headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !isDataRow(row, cfg.dateCol)) continue;
    const t = parseDate(row[cfg.dateCol]);
    if (t === null) continue;
    if (rangeStart !== null && t < rangeStart) continue;
    if (rangeEnd !== null && t > rangeEnd) continue;
    if (firstTs === null || t < firstTs) firstTs = t;
    if (lastTs === null || t > lastTs) lastTs = t;

    for (let v = 0; v < valueCols.length; v++) {
      const val = parseNumber(row[valueCols[v].col]);
      if (val !== null) {
        seriesReadings[v].push({ t, value: Number(val.toFixed(4)) });
      }
    }
  }

  const series: InstrumentSeries[] = [];
  let primaryReadings: ReadingPoint[] = [];
  for (let v = 0; v < valueCols.length; v++) {
    if (seriesReadings[v].length === 0) continue;
    const sampled = sampleReadings(seriesReadings[v], 200);
    series.push({
      label: valueCols[v].label || `Series ${v + 1}`,
      color: valueCols[v].color || DEFAULT_COLORS[v % DEFAULT_COLORS.length],
      readings: sampled,
    });
    if (primaryReadings.length === 0) primaryReadings = sampled;
  }

  if (series.length === 0) return null;

  return {
    code: cfg.instrumentCode || cfg.sheetName,
    label: cfg.instrumentLabel || cfg.instrumentCode || cfg.sheetName,
    type: cfg.instrumentType,
    sheetName: cfg.sheetName,
    readings: primaryReadings,
    series,
    dateStart: firstTs ?? undefined,
    dateEnd: lastTs ?? undefined,
  };
}

// ─── Load all configured data for a station ──────────────────────────

export async function getConfiguredStationData(stationId: string) {
  const dataSources = await db.dataSource.findMany({
    where: { stationId, status: { in: ["CONFIGURED", "ACTIVE"] } },
    include: { sheets: true },
  });

  const byType: Record<string, InstrumentData[]> = {
    EXTENSOMETER: [],
    CRACKMETER: [],
    TILTMETER: [],
    OBSERVATION_WELL: [],
    INCLINOMETER: [],
    OTHER: [],
  };

  for (const ds of dataSources) {
    for (const sheet of ds.sheets) {
      if (!sheet.enabled) continue;
      const parsed = await parseSheetWithConfig(ds.filePath, {
        sheetName: sheet.sheetName,
        instrumentType: sheet.instrumentType,
        instrumentCode: sheet.instrumentCode,
        instrumentLabel: sheet.instrumentLabel,
        headerRow: sheet.headerRow,
        dateCol: sheet.dateCol,
        valueCols: sheet.valueCols,
        dateRangeStart: sheet.dateRangeStart,
        dateRangeEnd: sheet.dateRangeEnd,
      });
      if (parsed) {
        if (!byType[parsed.type]) byType[parsed.type] = [];
        byType[parsed.type].push(parsed);
      }
    }
  }

  // Inclinometer images
  const inclinometerImages = await db.inclinometerImage.findMany({
    where: { stationId },
    orderBy: { updatedAt: "desc" },
  });

  return {
    stationId,
    extensometers: byType.EXTENSOMETER,
    crackmeters: byType.CRACKMETER,
    tiltmeters: byType.TILTMETER,
    observationWells: byType.OBSERVATION_WELL,
    inclinometers: byType.INCLINOMETER,
    other: byType.OTHER,
    inclinometerImages: inclinometerImages.map((img) => ({
      id: img.id,
      instrumentCode: img.instrumentCode,
      instrumentLabel: img.instrumentLabel,
      fileName: img.fileName,
      filePath: img.filePath,
      uploadedAt: img.uploadedAt.toISOString(),
      updatedAt: img.updatedAt.toISOString(),
    })),
  };
}
