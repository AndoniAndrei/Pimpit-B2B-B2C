/**
 * Safe math formula evaluator.
 * Variables are referenced as {column_name} in the formula.
 * Example: {Price_EUR} * 5 * 1.19 + 20
 */
export function evaluateFormula(formula: string, row: Record<string, any>): number {
  let expr = formula.trim();

  // Replace all {field_name} with their numeric values from the row
  expr = expr.replace(/\{([^}]+)\}/g, (_match, fieldName) => {
    const rawVal = row[fieldName];
    if (rawVal === undefined || rawVal === null || rawVal === '') return '0';
    const num = parseFloat(String(rawVal).replace(',', '.').replace(/[^\d.-]/g, ''));
    return isNaN(num) ? '0' : String(num);
  });

  // Sanitize: after replacing variables, only math characters are allowed
  const sanitized = expr.replace(/\s+/g, '');
  if (!/^[\d+\-*/().]+$/.test(sanitized)) {
    throw new Error(`Formula conține caractere invalide: "${expr}"`);
  }

  const result = Function('"use strict"; return (' + expr + ')')() as number;

  if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
    throw new Error(`Formula a returnat o valoare invalidă: ${result}`);
  }

  return Math.round(result * 100) / 100;
}

/** Extract all {variable} names from a formula string */
export function extractFormulaVariables(formula: string): string[] {
  const matches = formula.match(/\{([^}]+)\}/g) || [];
  return matches.map(m => m.slice(1, -1));
}
