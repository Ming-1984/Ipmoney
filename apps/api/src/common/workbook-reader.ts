import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import path from 'node:path';

type WorkbookReadOptions = {
  fileName?: string | null;
};

function normalizeCellValue(value: ExcelJS.CellValue | null): any {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeCellValue(item as ExcelJS.CellValue)).join('');
  }
  if (typeof value === 'object') {
    if ('result' in value) return normalizeCellValue((value as any).result ?? '');
    if ('text' in value && typeof (value as any).text === 'string') return (value as any).text;
    if ('richText' in value && Array.isArray((value as any).richText)) {
      return (value as any).richText.map((item: any) => String(item?.text ?? '')).join('');
    }
    if ('hyperlink' in value) return String((value as any).text || (value as any).hyperlink || '');
  }
  return String(value);
}

function toHeaderCell(value: ExcelJS.CellValue | null): string {
  const normalized = normalizeCellValue(value);
  return String(normalized ?? '').trim();
}

async function loadXlsxWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  return workbook;
}

async function loadCsvWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.csv.read(Readable.from(buffer), {
    map(value: string) {
      return value;
    },
  });
  return workbook;
}

async function loadWorkbook(buffer: Buffer, fileName: string): Promise<ExcelJS.Workbook> {
  const extension = path.extname(fileName || '').toLowerCase();
  if (extension === '.csv' || extension === '.txt') {
    return await loadCsvWorkbook(buffer);
  }

  try {
    return await loadXlsxWorkbook(buffer);
  } catch {
    if (extension) throw new Error('invalid-workbook');
    return await loadCsvWorkbook(buffer);
  }
}

export async function readWorkbookRowsFromBuffer(
  buffer: Buffer,
  options: WorkbookReadOptions = {},
): Promise<Array<Record<string, any>>> {
  const workbook = await loadWorkbook(buffer, String(options.fileName || ''));
  const worksheet = workbook.worksheets?.[0];
  if (!worksheet) return [];

  const headerRow = worksheet.getRow(1);
  const maxColumns = Math.max(headerRow.actualCellCount, worksheet.actualColumnCount);
  if (maxColumns <= 0) return [];

  const keyCounts = new Map<string, number>();
  const headers: string[] = [];
  for (let column = 1; column <= maxColumns; column += 1) {
    const rawHeader = toHeaderCell(headerRow.getCell(column).value ?? null);
    const base = rawHeader || '__EMPTY';
    const count = keyCounts.get(base) || 0;
    keyCounts.set(base, count + 1);
    headers.push(count === 0 ? base : `${base}_${count}`);
  }
  if (!headers.some((item) => item && item !== '__EMPTY')) {
    return [];
  }

  const rows: Array<Record<string, any>> = [];
  for (let rowNo = 2; rowNo <= worksheet.actualRowCount; rowNo += 1) {
    const row = worksheet.getRow(rowNo);
    const mapped: Record<string, any> = {};
    let hasValue = false;
    for (let column = 1; column <= maxColumns; column += 1) {
      const key = headers[column - 1];
      const value = normalizeCellValue(row.getCell(column).value ?? null);
      mapped[key] = value;
      if (!hasValue) {
        if (value instanceof Date) {
          hasValue = true;
        } else if (typeof value === 'number' && Number.isFinite(value)) {
          hasValue = true;
        } else if (typeof value === 'boolean') {
          hasValue = true;
        } else if (String(value || '').trim()) {
          hasValue = true;
        }
      }
    }
    if (!hasValue) continue;
    rows.push(mapped);
  }

  return rows;
}

export function parseExcelSerialDate(value: number): Date | null {
  if (!Number.isFinite(value)) return null;
  const days = Math.trunc(value);
  const fraction = value - days;
  const epochUtc = Date.UTC(1899, 11, 30);
  const millisFromFraction = Math.round(fraction * 24 * 60 * 60 * 1000);
  const date = new Date(epochUtc + days * 24 * 60 * 60 * 1000 + millisFromFraction);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}
