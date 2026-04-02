import { parseSmartNumber } from './priceParser';

/**
 * Evaluates a math formula string with {column_name} variable substitution.
 *
 * Examples:
 *   "{Price_EUR} * 5 * 1.19 + 20"   with row = { Price_EUR: "14.000,00" } → 83320.00
 *   "{Pret} * 1.10"                  with row = { Pret: "1200" }            → 1320.00
 *   "({SRP} + {NET}) / 2 * 1.19"
 */
export function evaluateFormula(formula: string, row: Record<string, any>): number {
  if (!formula?.trim()) throw new Error('Formula este goală');

  let expr = formula.trim();

  // Replace all {field_name} tokens with their numeric values
  expr = expr.replace(/\{([^}]+)\}/g, (_match, fieldName) => {
    const rawVal = row[fieldName];
    if (rawVal === undefined || rawVal === null || rawVal === '') return '0';
    const num = parseSmartNumber(rawVal);
    if (num === null) return '0';
    return String(num);
  });

  // After substitution, only math characters are valid
  const sanitized = expr.replace(/\s+/g, '');
  if (!/^[\d+\-*/().^]+$/.test(sanitized)) {
    throw new Error(`Formula conține caractere invalide după evaluare: "${expr}"`);
  }

  let result: number;
  try {
    // eslint-disable-next-line no-new-func
    result = Function('"use strict"; return (' + expr + ')')() as number;
  } catch {
    throw new Error(`Eroare la evaluarea formulei: "${expr}"`);
  }

  if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
    throw new Error(`Formula a returnat o valoare invalidă: ${result}`);
  }

  return Math.round(result * 100) / 100;
}

/** Extract all {variable} names referenced in a formula */
export function extractFormulaVariables(formula: string): string[] {
  const matches = formula.match(/\{([^}]+)\}/g) || [];
  const vars = matches.map(m => m.slice(1, -1));
  return vars.filter((v, i) => vars.indexOf(v) === i);
}

/** Validate a formula without a row — checks syntax only */
export function validateFormula(formula: string): { valid: boolean; error?: string } {
  if (!formula?.trim()) return { valid: false, error: 'Formula nu poate fi goală' };
  try {
    // Test with dummy values
    const vars = extractFormulaVariables(formula);
    const dummyRow = Object.fromEntries(vars.map(v => [v, '100']));
    evaluateFormula(formula, dummyRow);
    return { valid: true };
  } catch (e: any) {
    return { valid: false, error: e.message };
  }
}
