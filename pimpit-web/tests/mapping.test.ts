import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRow, resolveTemplate, FieldMappings } from '../lib/genericParser';
import { parseFeedText } from '../lib/feedParser';
import { normalizeAndJoinPcds, splitAndNormalizePcds } from '../lib/pcdUtils';
import { parseEtRange } from '../lib/etRangeParser';
import { deduplicateProducts } from '../lib/importRunner';

const MAPPINGS: FieldMappings = {
  part_number: 'SKU',
  brand: 'Brand',
  name: '{Model} {Size}',
  price_formula: '{Price} * 1.19',
  stock: 'Stock',
  diameter: 'Diameter',
  width: 'Width',
  pcd: 'PCD',
  et_offset: 'ET',
};

test('parseFeedText — CSV cu delimitator', () => {
  const rows = parseFeedText('a;b\n1;2\n3;4', 'csv', ';');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { a: '1', b: '2' });
});

test('resolveTemplate — substituție {col}', () => {
  assert.equal(resolveTemplate('{Model} {Size}', { Model: 'JR11', Size: '19x9.5' }), 'JR11 19x9.5');
  assert.equal(resolveTemplate('Brand', { Brand: ' STW ' }), 'STW');
});

test('parseRow — mapare completă rând → produs', () => {
  const row = {
    SKU: 'JR1119955X112', Brand: 'Japan Racing', Model: 'JR11', Size: '19x9.5',
    Price: '1.000,00', Stock: '8', Diameter: '19', Width: '9,5',
    PCD: '5x112', ET: '35',
  };
  const p = parseRow(row, MAPPINGS, 1);
  assert.ok(p);
  assert.equal(p!.partNumber, 'JR1119955X112');
  assert.equal(p!.name, 'JR11 19x9.5');
  assert.equal(p!.calculatedPrice, 1190);
  assert.equal(p!.stock, 8);
  assert.equal(p!.diameter, 19);
  assert.equal(p!.width, 9.5);
  assert.equal(p!.pcd, '5X112');
  assert.equal(p!.etOffset, 35);
  assert.equal(p!.etMin, 35);
  assert.equal(p!.etMax, 35);
});

test('parseRow — fără part_number → null', () => {
  assert.equal(parseRow({ Brand: 'X', Price: '10' }, MAPPINGS, 1), null);
});

test('parseRow — preț 0 marcat, nu aruncat', () => {
  const p = parseRow({ SKU: 'A1', Brand: 'B', Model: 'M', Price: '0' }, MAPPINGS, 1);
  assert.ok(p);
  assert.equal(p!.priceIsZero, true);
});

test('parseRow — ET interval "20-50" → etMin/etMax', () => {
  const p = parseRow(
    { SKU: 'A2', Brand: 'B', Model: 'M', Price: '100', ET: '20-50' },
    MAPPINGS, 1
  );
  assert.equal(p!.etMin, 20);
  assert.equal(p!.etMax, 50);
});

test('pcdUtils — normalizare multi-bolt', () => {
  assert.equal(normalizeAndJoinPcds('5x112/4x100'), '5X112/4X100');
  assert.deepEqual(splitAndNormalizePcds('5X112 / 4X100'), ['5X112', '4X100']);
});

test('parseEtRange — listă continuă și interval', () => {
  assert.deepEqual(parseEtRange('20-50'), { min: 20, max: 50, isRange: true });
  const list = parseEtRange('20,21,22,23,24,25');
  assert.equal(list?.min, 20);
  assert.equal(list?.max, 25);
  assert.deepEqual(parseEtRange('35'), { min: 35, max: 35, isRange: false });
});

test('deduplicateProducts — păstrează prețul valid cel mai mare per (PN, brand)', () => {
  const base = (over: Partial<ReturnType<typeof parseRow> extends infer _ ? any : never>) => ({
    partNumber: 'PN1', brand: 'BrandA', name: 'X', calculatedPrice: 100,
    priceIsZero: false, rawPrice: 80, rawCurrency: 'RON', stock: 1, stockIncoming: 0,
    images: [], discontinued: false, productType: 'jante', customFields: {},
    supplierId: 1, rawData: {},
    ...over,
  });
  const result = deduplicateProducts([
    base({ calculatedPrice: 100 }),
    base({ calculatedPrice: 250 }),                       // câștigă (preț valid mai mare)
    base({ calculatedPrice: 999, priceIsZero: true }),    // ignorat (preț zero/eronat)
    base({ partNumber: 'PN2', calculatedPrice: 50 }),     // alt PN — rămâne
  ] as never[]);
  assert.equal(result.length, 2);
  const pn1 = result.find(p => p.partNumber === 'PN1')!;
  assert.equal(pn1.calculatedPrice, 250);
});
