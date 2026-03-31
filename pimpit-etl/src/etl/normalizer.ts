export function cleanText(val: any): string | undefined {
  if (val === null || val === undefined) return undefined;
  const str = String(val).trim();
  return str === '' ? undefined : str;
}

export function cleanNumber(val: any): number | undefined {
  if (val === null || val === undefined || val === '') return undefined;
  if (typeof val === 'number') return val;
  const str = String(val).replace(/,/g, '.').replace(/[^0-9.-]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? undefined : num;
}

export function normalizePcd(val: any): string | undefined {
  const str = cleanText(val);
  if (!str) return undefined;
  // Convert "5-112" or "5/112" to "5x112"
  return str.replace(/[-/]/g, 'x').toLowerCase();
}

export function normalizeEt(val: any): number | undefined {
  const str = cleanText(val);
  if (!str) return undefined;
  const match = str.match(/[-]?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : undefined;
}

export function parseSize(val: any): { diameter?: number, width?: number } {
  const str = cleanText(val);
  if (!str) return {};
  const parts = str.toLowerCase().split('x');
  if (parts.length === 2) {
    return { diameter: cleanNumber(parts[0]), width: cleanNumber(parts[1]) };
  }
  return {};
}

export function normalizeImages(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(v => !!v).map(v => String(v).trim());
  const str = String(val).trim();
  if (!str) return [];
  return str.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

export function extractEtFromDescription(desc: string | undefined): number | undefined {
  if (!desc) return undefined;
  const match = desc.match(/ET\s*([-]?\d+(\.\d+)?)/i);
  if (match) return parseFloat(match[1]);
  return undefined;
}

export function generateSlug(brand: string, name: string, diameter?: number, width?: number, pcd?: string): string {
  const parts = [brand, name];
  if (diameter && width) parts.push(`${diameter}x${width}`);
  if (pcd) parts.push(pcd);
  
  return parts.join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function applyTransforms(row: any, transforms: any[]): any {
  const newRow = { ...row };
  for (const t of transforms) {
    if (t.transform_type === 'brand_remap') {
      const rules = t.config.rules || [];
      for (const rule of rules) {
        const fieldVal = cleanText(newRow[rule.match_field]);
        if (!fieldVal) continue;
        
        let isMatch = false;
        if (rule.contains && fieldVal.toLowerCase().includes(rule.contains.toLowerCase())) isMatch = true;
        if (rule.equals && fieldVal.toLowerCase() === rule.equals.toLowerCase()) isMatch = true;
        
        if (isMatch) {
          newRow.brand = rule.new_brand;
          newRow.name = rule.new_name;
          break; // apply first match only
        }
      }
    }
  }
  return newRow;
}
