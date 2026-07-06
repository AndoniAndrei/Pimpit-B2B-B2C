/**
 * Detectare automată de format și delimitator pentru feed-uri.
 */

/** Deduce formatul din numele fișierului / calea snapshotului. */
export function detectFormatFromName(name: string): 'csv' | 'json' | 'xlsx' {
  const lower = name.toLowerCase().replace(/\.gz$/, '');
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'xlsx';
  return 'csv';
}

/**
 * Detectează delimitatorul CSV numărând aparițiile consistente pe primele
 * rânduri. Întoarce ',' când nu se poate decide.
 */
export function detectCsvDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter(l => l.trim()).slice(0, 5);
  if (lines.length === 0) return ',';
  const candidates = [',', ';', '\t', '|'];
  let best = ',';
  let bestScore = 0;
  for (const d of candidates) {
    const counts = lines.map(l => countOutsideQuotes(l, d));
    const first = counts[0];
    if (first === 0) continue;
    const consistent = counts.every(c => c === first);
    const score = first + (consistent ? 100 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

function countOutsideQuotes(line: string, delim: string): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === delim && !inQuotes) count++;
  }
  return count;
}
