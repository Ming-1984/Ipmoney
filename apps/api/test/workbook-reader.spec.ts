import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { parseExcelSerialDate, readWorkbookRowsFromBuffer } from '../src/common/workbook-reader';

async function createXlsxBuffer(builder: (workbook: ExcelJS.Workbook) => void): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  builder(workbook);
  const out = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}

describe('workbook-reader', () => {
  it('reads xlsx rows and de-duplicates duplicated header names', async () => {
    const buffer = await createXlsxBuffer((workbook) => {
      const sheet = workbook.addWorksheet('Sheet1');
      sheet.addRow(['Patent No', 'Apply Date', 'Patent No']);
      sheet.addRow(['CN-001', new Date('2024-01-02T00:00:00.000Z'), 'CN-001-ALT']);
      sheet.addRow(['', '', '']);
    });

    const rows = await readWorkbookRowsFromBuffer(buffer, { fileName: 'import.xlsx' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      'Patent No': 'CN-001',
      'Patent No_1': 'CN-001-ALT',
    });
    expect(rows[0]['Apply Date']).toBeInstanceOf(Date);
  });

  it('reads csv rows and skips empty rows', async () => {
    const csv = ['Patent No,Apply Date', 'CN-001,2024-01-02', ',', 'CN-002,2024-01-03'].join('\n');
    const rows = await readWorkbookRowsFromBuffer(Buffer.from(csv, 'utf8'), { fileName: 'import.csv' });

    expect(rows).toEqual([
      { 'Patent No': 'CN-001', 'Apply Date': '2024-01-02' },
      { 'Patent No': 'CN-002', 'Apply Date': '2024-01-03' },
    ]);
  });

  it('parses excel serial date', () => {
    const date = parseExcelSerialDate(45292);
    expect(date).not.toBeNull();
    expect(date!.toISOString().slice(0, 10)).toBe('2024-01-01');
    expect(parseExcelSerialDate(Number.NaN)).toBeNull();
  });
});
