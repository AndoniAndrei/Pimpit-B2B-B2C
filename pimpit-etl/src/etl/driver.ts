import Papa from 'papaparse';
import { SupplierConfig, FetchError } from '../types/etl.js';

export function buildFeedUrl(supplier: SupplierConfig): string {
  let url = supplier.feedUrl;
  if (supplier.authMethod === 'api_key' && supplier.apiKeyRef) {
    const key = process.env[supplier.apiKeyRef];
    if (key) url = url.replace('{API_KEY}', key);
  }
  if (supplier.tokenRef && url.includes('{TOKEN}')) {
    const token = process.env[supplier.tokenRef];
    if (token) url = url.replace('{TOKEN}', token);
  }
  return url;
}

export function buildAuthHeaders(supplier: SupplierConfig): Record<string, string> {
  const headers: Record<string, string> = {};
  if (supplier.authMethod === 'basic_auth' && supplier.customerIdRef && supplier.tokenRef) {
    const user = process.env[supplier.customerIdRef];
    const pass = process.env[supplier.tokenRef];
    if (user && pass) {
      const b64 = Buffer.from(`${user}:${pass}`).toString('base64');
      headers['Authorization'] = `Basic ${b64}`;
    }
  }
  return headers;
}

export async function fetchWithRetry(url: string, headers: Record<string, string>, supplierId: number, retries = 3): Promise<string> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min timeout
      
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        throw new FetchError(supplierId, url, res.status, `HTTP ${res.status} ${res.statusText}`);
      }
      return await res.text();
    } catch (error: any) {
      attempt++;
      if (attempt >= retries) {
        throw new FetchError(supplierId, url, undefined, error.message);
      }
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000)); // Exponential backoff
    }
  }
  throw new Error('Unreachable');
}

export function parseCsvRaw(csvText: string, delimiter: string): any[] {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    delimiter: delimiter,
    dynamicTyping: false
  });
  if (parsed.errors.length > 0) {
    console.warn(`CSV parsing warnings:`, parsed.errors.slice(0, 5));
  }
  return parsed.data;
}

export function parseJsonRaw(jsonText: string): any[] {
  const data = JSON.parse(jsonText);
  if (Array.isArray(data)) return data;
  // If object, find the first array property
  for (const key in data) {
    if (Array.isArray(data[key])) return data[key];
  }
  return [];
}

export function getField(row: any, fieldName: string): any {
  if (row[fieldName] !== undefined) return row[fieldName];
  // Case insensitive search
  const lowerKey = fieldName.toLowerCase();
  for (const key in row) {
    if (key.toLowerCase() === lowerKey) return row[key];
  }
  return undefined;
}
