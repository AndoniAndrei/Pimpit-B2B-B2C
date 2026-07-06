import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTransformChain, passesRowFilter } from '../lib/import/engine/transforms';
import {
  mapRow, dedupeMappedRows, coerceAttributeValue, validateAttributeValue,
  type MappingContext, type AttributeDefLite,
} from '../lib/import/engine/mapper';

// ── Transforms ───────────────────────────────────────────────────────────────

test('applyTransformChain — lanț de transformări', () => {
  assert.equal(applyTransformChain('  abc  ', [{ type: 'trim' }, { type: 'uppercase' }]), 'ABC');
  assert.equal(applyTransformChain('1.234,56', [{ type: 'number_locale' }]), '1234.56');
  assert.equal(applyTransformChain('254', [{ type: 'unit_convert', from: 'mm', to: 'inch' }]), '10');
  assert.equal(applyTransformChain('19x9.5', [{ type: 'regex_extract', pattern: '^(\\d+)x' }]), '19');
  assert.equal(applyTransformChain('stw', [{ type: 'value_remap', map: { stw: 'STW' } }]), 'STW');
});

test('passesRowFilter — operatori', () => {
  const row = { Brand: 'Japan Racing', Stock: '' };
  assert.equal(passesRowFilter(row, { column: 'Brand', op: 'in', values: ['japan racing'] }), true);
  assert.equal(passesRowFilter(row, { column: 'Brand', op: 'not_in', values: ['ford'] }), true);
  assert.equal(passesRowFilter(row, { column: 'Stock', op: 'not_empty' }), false);
  assert.equal(passesRowFilter(row, { column: 'Brand', op: 'regex', value: '^japan' }), true);
});

// ── Coerce + validare atribute ───────────────────────────────────────────────

const numDef: AttributeDefLite = {
  id: 1, code: 'diameter_inch', data_type: 'number', enum_options: null,
  is_required: true, validation: { min: 10, max: 26 },
};

test('coerceAttributeValue — tipuri', () => {
  assert.equal(coerceAttributeValue('19', numDef), 19);
  assert.equal(coerceAttributeValue('9,5', { ...numDef, code: 'w' }), 9.5);
  assert.deepEqual(
    coerceAttributeValue('20-50', { ...numDef, data_type: 'range', code: 'et_offset' }),
    { min: 20, max: 50 }
  );
  assert.deepEqual(
    coerceAttributeValue('5x112/4x100', { ...numDef, data_type: 'multi_enum', code: 'bolt_pattern' }),
    ['5X112', '4X100']
  );
  assert.equal(coerceAttributeValue('da', { ...numDef, data_type: 'boolean', code: 'rf' }), true);
  assert.equal(coerceAttributeValue('abc', numDef), null);
});

test('validateAttributeValue — min/max și enum', () => {
  assert.equal(validateAttributeValue(19, numDef), null);
  assert.equal(validateAttributeValue(99, numDef)?.code, 'OUT_OF_RANGE');
  const enumDef: AttributeDefLite = {
    id: 2, code: 'season', data_type: 'enum', enum_options: ['Vară', 'Iarnă'],
    is_required: false, validation: null,
  };
  assert.equal(validateAttributeValue('vară', enumDef), null); // case-insensitive
  assert.equal(validateAttributeValue('Toamnă', enumDef)?.code, 'UNKNOWN_ENUM_VALUE');
});

// ── mapRow end-to-end (profil de jante) ──────────────────────────────────────

function wheelsCtx(): MappingContext {
  return {
    supplierId: 1,
    fieldMappings: [
      { target_kind: 'core', target_code: 'part_number', source_expression: 'SKU', transform: [], required: true, default_value: null, position: 1 },
      { target_kind: 'core', target_code: 'brand', source_expression: 'Marke', transform: [], required: true, default_value: null, position: 2 },
      { target_kind: 'core', target_code: 'family_name', source_expression: 'Modell', transform: [], required: false, default_value: null, position: 3 },
      { target_kind: 'core', target_code: 'name', source_expression: '{Modell} {Groesse}', transform: [], required: false, default_value: null, position: 4 },
      { target_kind: 'attribute', target_code: 'diameter_inch', source_expression: 'Zoll', transform: [], required: false, default_value: null, position: 5 },
      { target_kind: 'attribute', target_code: 'et_offset', source_expression: 'ET', transform: [], required: false, default_value: null, position: 6 },
      { target_kind: 'attribute', target_code: 'bolt_pattern', source_expression: 'LK', transform: [], required: false, default_value: null, position: 7 },
      { target_kind: 'offer', target_code: 'raw_price', source_expression: 'Preis', transform: [], required: true, default_value: null, position: 8 },
      { target_kind: 'offer', target_code: 'stock', source_expression: 'Bestand', transform: [], required: false, default_value: '0', position: 9 },
      { target_kind: 'media', target_code: 'image_url_1', source_expression: 'Bild', transform: [], required: false, default_value: null, position: 10 },
    ],
    rules: [
      { rule_type: 'row_filter', config: { column: 'Marke', op: 'not_empty' }, position: 1 },
      { rule_type: 'brand_normalize', config: { extra: { jr: 'Japan Racing' } }, position: 2 },
      { rule_type: 'currency_convert', config: { currency: 'EUR' }, position: 3 },
    ],
    attributeDefs: [
      { id: 1, code: 'diameter_inch', data_type: 'number', enum_options: null, is_required: true, validation: { min: 10, max: 26 } },
      { id: 2, code: 'et_offset', data_type: 'range', enum_options: null, is_required: false, validation: { min: -90, max: 150 } },
      { id: 3, code: 'bolt_pattern', data_type: 'multi_enum', enum_options: null, is_required: false, validation: null },
    ],
    brands: [{ id: 7, name: 'Japan Racing', slug: 'japan-racing', aliases: ['japanracing'] }],
    rates: { RON: 1, EUR: 5.0 },
  };
}

const ROW = {
  SKU: 'JR11-19-95', Marke: 'jr', Modell: 'JR11', Groesse: '19x9.5',
  Zoll: '19', ET: '20-45', LK: '5x112/5x120', Preis: '200,00', Bestand: '12',
  Bild: 'https://cdn.example.com/jr11.jpg',
};

test('mapRow — profil jante complet: brand remap, EUR→RON, atribute tipizate', () => {
  const m = mapRow(ROW, wheelsCtx());
  assert.equal(m.errors.length, 0, JSON.stringify(m.errors));
  assert.equal(m.core.partNumber, 'JR11-19-95');
  assert.equal(m.core.brandName, 'Japan Racing');
  assert.equal(m.core.brandId, 7);
  assert.equal(m.core.familyName, 'JR11');
  assert.equal(m.core.name, 'JR11 19x9.5');
  assert.equal(m.offer.rawPrice, 200);
  assert.equal(m.offer.currency, 'EUR');
  assert.equal(m.offer.price, 1000); // 200 EUR × 5.0
  assert.equal(m.offer.stock, 12);
  assert.equal(m.attributes.diameter_inch, 19);
  assert.deepEqual(m.attributes.et_offset, { min: 20, max: 45 });
  assert.deepEqual(m.attributes.bolt_pattern, ['5X112', '5X120']);
  assert.deepEqual(m.media, ['https://cdn.example.com/jr11.jpg']);
});

test('mapRow — formula are prioritate peste conversia valutară', () => {
  const ctx = wheelsCtx();
  ctx.rules.push({ rule_type: 'formula', config: { target: 'offer:price', expression: '{Preis} * 5 * 1.19' }, position: 4 });
  const m = mapRow(ROW, wheelsCtx().rules ? { ...ctx } : ctx);
  assert.equal(m.offer.price, 1190); // 200 × 5 × 1.19
});

test('mapRow — row_filter sare rândul fără eroare', () => {
  const m = mapRow({ ...ROW, Marke: '' }, wheelsCtx());
  assert.ok(m.skipped);
  assert.equal(m.errors.length, 0);
});

test('mapRow — brand necunoscut fără auto_create → eroare', () => {
  const m = mapRow({ ...ROW, Marke: 'NoName Wheels' }, wheelsCtx());
  assert.ok(m.errors.some(e => e.code === 'UNKNOWN_BRAND'));
});

test('mapRow — atribut obligatoriu lipsă → eroare', () => {
  const m = mapRow({ ...ROW, Zoll: '' }, wheelsCtx());
  assert.ok(m.errors.some(e => e.code === 'MISSING_REQUIRED_ATTRIBUTE' && e.field === 'diameter_inch'));
});

test('mapRow — valoare în afara intervalului → eroare OUT_OF_RANGE', () => {
  const m = mapRow({ ...ROW, Zoll: '99' }, wheelsCtx());
  assert.ok(m.errors.some(e => e.code === 'OUT_OF_RANGE' && e.field === 'diameter_inch'));
});

test('dedupeMappedRows — păstrează prețul valid cel mai mare', () => {
  const ctx = wheelsCtx();
  const a = mapRow(ROW, ctx);
  const b = mapRow({ ...ROW, Preis: '300,00' }, ctx);
  const deduped = dedupeMappedRows([a, b]);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].offer.price, 1500);
});
