import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateFormula } from '../lib/formulaEvaluator';
import { parseSmartNumber } from '../lib/priceParser';

test('parseSmartNumber — format european', () => {
  assert.equal(parseSmartNumber('14.000,00'), 14000);
  assert.equal(parseSmartNumber('1.234.567,89'), 1234567.89);
  assert.equal(parseSmartNumber('14,5'), 14.5);
  assert.equal(parseSmartNumber('1.431 lei'), 1431);
});

test('parseSmartNumber — format US și numere simple', () => {
  assert.equal(parseSmartNumber('14,000.00'), 14000);
  assert.equal(parseSmartNumber('14.5'), 14.5);
  assert.equal(parseSmartNumber('14000'), 14000);
  assert.equal(parseSmartNumber(14000), 14000);
  assert.equal(parseSmartNumber('€ 1.234,56'), 1234.56);
});

test('parseSmartNumber — invalid → null', () => {
  assert.equal(parseSmartNumber(''), null);
  assert.equal(parseSmartNumber(null), null);
  assert.equal(parseSmartNumber(undefined), null);
  assert.equal(parseSmartNumber('abc'), null);
});

test('evaluateFormula — formule de preț cu variabile', () => {
  assert.equal(evaluateFormula('{price} * 1.19', { price: '100' }), 119);
  assert.equal(evaluateFormula('{Price_EUR} * 5 * 1.19 + 20', { Price_EUR: '14.000,00' }), 83320);
  assert.equal(evaluateFormula('({SRP} + {NET}) / 2', { SRP: 200, NET: 100 }), 150);
  // câmp lipsă → 0
  assert.equal(evaluateFormula('{missing} * 2 + 10', {}), 10);
});

test('evaluateFormula — respinge injecția de cod', () => {
  assert.throws(() => evaluateFormula('process.exit(1)', {}));
  assert.throws(() => evaluateFormula('{p}; alert(1)', { p: 1 }));
});

test('evaluateFormula — rezultat invalid → eroare', () => {
  assert.throws(() => evaluateFormula('{p} / 0', { p: 0 }));   // NaN
  assert.throws(() => evaluateFormula('', {}));
});
