import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectFormatFromName, detectCsvDelimiter } from '../lib/import/detect';

test('detectFormatFromName', () => {
  assert.equal(detectFormatFromName('feed.csv'), 'csv');
  assert.equal(detectFormatFromName('export.XLSX'), 'xlsx');
  assert.equal(detectFormatFromName('data.json'), 'json');
  assert.equal(detectFormatFromName('arhiva.csv.gz'), 'csv');
  assert.equal(detectFormatFromName('uploads/123-produse.xls'), 'xlsx');
  assert.equal(detectFormatFromName('fara-extensie'), 'csv');
});

test('detectCsvDelimiter — virgulă, punct-virgulă, tab', () => {
  assert.equal(detectCsvDelimiter('a,b,c\n1,2,3\n4,5,6'), ',');
  assert.equal(detectCsvDelimiter('a;b;c\n1;2;3'), ';');
  assert.equal(detectCsvDelimiter('a\tb\tc\n1\t2\t3'), '\t');
  assert.equal(detectCsvDelimiter('a|b|c\n1|2|3'), '|');
});

test('detectCsvDelimiter — ignoră delimitatorii din ghilimele', () => {
  assert.equal(detectCsvDelimiter('"a,x";b;c\n"1,y";2;3'), ';');
});

test('detectCsvDelimiter — fallback la virgulă', () => {
  assert.equal(detectCsvDelimiter('singura_coloana\nvaloare'), ',');
  assert.equal(detectCsvDelimiter(''), ',');
});
