import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  slugify, convertUnit, toRon, resolveBrand,
  parseWheelSpec, parseTireSpec, normalizeMakeName, noneToNull,
} from '../lib/import/normalizers';

test('slugify — diacritice, spații, caractere speciale', () => {
  assert.equal(slugify('Jantă Așa & Așa 19"'), 'janta-asa-asa-19');
  assert.equal(slugify('  Japan Racing JR-11 '), 'japan-racing-jr-11');
  assert.equal(slugify('Škoda Octavia'), 'skoda-octavia');
});

test('convertUnit — lungime și masă', () => {
  assert.equal(convertUnit(25.4, 'mm', 'inch'), 1);
  assert.equal(convertUnit(2, 'inch', 'mm'), 50.8);
  assert.equal(convertUnit(500, 'g', 'kg'), 0.5);
  assert.throws(() => convertUnit(1, 'mm', 'kg'));
});

test('toRon — conversie valutară', () => {
  const rates = { RON: 1, EUR: 5.0, SEK: 0.46 };
  assert.equal(toRon(100, 'EUR', rates), 500);
  assert.equal(toRon(100, 'ron', rates), 100);
  assert.throws(() => toRon(100, 'XYZ', rates));
});

test('resolveBrand — nume canonic + aliasuri, case-insensitive', () => {
  const brands = [
    { name: 'STW', aliases: ['stw wheels'] },
    { name: 'Japan Racing', aliases: ['japanracing', 'jr wheels'] },
  ];
  assert.equal(resolveBrand('stw', brands), 'STW');
  assert.equal(resolveBrand('JAPANRACING', brands), 'Japan Racing');
  assert.equal(resolveBrand('Japan Racing', brands), 'Japan Racing');
  assert.equal(resolveBrand('NoName', brands), null);
});

test('parseWheelSpec — formatul galeriei FI', () => {
  assert.deepEqual(parseWheelSpec('R19, J9.5, ET35'), { diameter: 19, width: 9.5, offset: 35 });
  assert.deepEqual(parseWheelSpec('R18, J8, ET-6'), { diameter: 18, width: 8, offset: -6 });
  assert.deepEqual(parseWheelSpec('R17, J8.5'), { diameter: 17, width: 8.5, offset: null });
  assert.equal(parseWheelSpec(''), null);
  assert.equal(parseWheelSpec('n/a'), null);
  // valori absurde respinse
  assert.equal(parseWheelSpec('R99, J9.5, ET35'), null);
});

test('parseTireSpec — dimensiune + etichetă brand/model', () => {
  const t = parseTireSpec('Lexani LX-Twenty 245/40R19 26.7"x9.6"');
  assert.deepEqual(t, { width: 245, aspect: 40, rimDiameter: 19, label: 'Lexani LX-Twenty' });
  const zr = parseTireSpec('Michelin Pilot Sport 4S 265/35ZR20');
  assert.equal(zr?.width, 265);
  assert.equal(zr?.rimDiameter, 20);
  assert.equal(parseTireSpec('fara dimensiune'), null);
  assert.equal(parseTireSpec(null), null);
});

test('normalizeMakeName — forme canonice', () => {
  assert.equal(normalizeMakeName('DACIA'), 'Dacia');
  assert.equal(normalizeMakeName('INFINITI'), 'Infiniti');
  assert.equal(normalizeMakeName('bmw'), 'BMW');
  assert.equal(normalizeMakeName('AM General'), 'AM General');
  assert.equal(normalizeMakeName('mclaren'), 'McLaren');
  assert.equal(normalizeMakeName('Opel/vauxhall'), 'Opel/Vauxhall');
  assert.equal(normalizeMakeName('alfa romeo'), 'Alfa Romeo');
  assert.equal(normalizeMakeName('rolls-royce'), 'Rolls-Royce');
  assert.equal(normalizeMakeName('Toyota'), 'Toyota');
});

test('noneToNull', () => {
  assert.equal(noneToNull('None'), null);
  assert.equal(noneToNull('none'), null);
  assert.equal(noneToNull(''), null);
  assert.equal(noneToNull(undefined), null);
  assert.equal(noneToNull('5mm'), '5mm');
});
