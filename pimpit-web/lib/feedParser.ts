/**
 * Centralized feed parsing utility.
 * Supports CSV, JSON, and XLSX (Excel) formats.
 */
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export type FeedFormat = 'csv' | 'json' | 'xlsx';

export function parseFeedBuffer(
  buffer: Buffer | ArrayBuffer,
  format: FeedFormat,
  delimiter = ','
): Record<string, any>[] {
  if (format === 'xlsx') {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
  }

  const text = Buffer.isBuffer(buffer)
    ? buffer.toString('utf-8')
    : new TextDecoder().decode(buffer);

  if (format === 'json') {
    const json = JSON.parse(text);
    return Array.isArray(json)
      ? json
      : (Object.values(json).find(Array.isArray) as any[]) || [];
  }

  // CSV
  const result = Papa.parse<Record<string, any>>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter: delimiter || ',',
  });
  return result.data;
}

export function parseFeedText(
  text: string,
  format: FeedFormat,
  delimiter = ','
): Record<string, any>[] {
  return parseFeedBuffer(Buffer.from(text, 'utf-8'), format, delimiter);
}
