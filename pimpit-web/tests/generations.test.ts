import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveGeneration } from '../lib/fitment/vehicleGenerations';

test('BMW Seria 5 — generația corectă pe an (exact scenariul 530 vs E60)', () => {
  assert.equal(resolveGeneration('bmw', '530i', 2005)?.code, 'E60/E61');
  assert.equal(resolveGeneration('bmw', '530i', 2005)?.pcd, '5X120');
  assert.equal(resolveGeneration('bmw', '5-series', 2000)?.code, 'E39');
  assert.equal(resolveGeneration('bmw', '5-series', 2000)?.centerBore, 74.1);
  assert.equal(resolveGeneration('bmw', '540i', 2013)?.code, 'F10/F11');
  // G30 = 5X112, NU 5X120 — confuzia periculoasă
  assert.equal(resolveGeneration('bmw', '530i', 2019)?.pcd, '5X112');
  assert.equal(resolveGeneration('bmw', 'm5', 2018)?.pcd, '5X112');
});

test('BMW M3 — trecerea 5X120 → 5X112 la G80', () => {
  assert.equal(resolveGeneration('bmw', 'm3', 2016)?.pcd, '5X120');
  assert.equal(resolveGeneration('bmw', 'm3', 2022)?.pcd, '5X112');
  assert.equal(resolveGeneration('bmw', 'm3', 1990)?.pcd, '4X100'); // E30!
});

test('VW GTI — trei prinderi diferite pe generații', () => {
  assert.equal(resolveGeneration('volkswagen', 'gti', 1990)?.pcd, '4X100');
  assert.equal(resolveGeneration('volkswagen', 'gti', 2003)?.pcd, '5X100');
  assert.equal(resolveGeneration('volkswagen', 'gti', 2018)?.pcd, '5X112');
});

test('Honda Civic — 4X100 → 5X114.3, cu note pentru excepții', () => {
  const old = resolveGeneration('honda', 'civic', 2004);
  assert.equal(old?.pcd, '4X100');
  assert.ok(old?.note?.includes('EP3'));
  assert.equal(resolveGeneration('honda', 'civic', 2015)?.pcd, '5X114.3');
});

test('Subaru WRX / Miata / MINI — schimbări de prindere între generații', () => {
  assert.equal(resolveGeneration('subaru', 'wrx', 2013)?.pcd, '5X100');
  assert.equal(resolveGeneration('subaru', 'wrx', 2016)?.pcd, '5X114.3');
  assert.equal(resolveGeneration('mazda', 'mx-5-miata', 2000)?.pcd, '4X100');
  assert.equal(resolveGeneration('mazda', 'mx-5-miata', 2010)?.pcd, '5X114.3'); // NC
  assert.equal(resolveGeneration('mazda', 'mx-5-miata', 2020)?.pcd, '4X100');   // ND revine
  assert.equal(resolveGeneration('mini', 'cooper', 2010)?.pcd, '4X100');
  assert.equal(resolveGeneration('mini', 'cooper', 2019)?.pcd, '5X112');
});

test('Cazuri ambigue → fără PCD, dar cu notă', () => {
  const accord2000 = resolveGeneration('honda', 'accord', 2000);
  assert.equal(accord2000?.pcd, undefined);
  assert.ok(accord2000?.note);
});

test('Necunoscut → null (nu ghicește)', () => {
  assert.equal(resolveGeneration('dacia', 'logan', 2015), null);
  assert.equal(resolveGeneration('bmw', 'x9', 2015), null);
});
