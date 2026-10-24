const test = require('node:test');
const assert = require('node:assert');
const { rank, comparePriority, suitableWards, usableCount } = require('../services/priority');

test('UT-20 Emergency outranks Urgent', () => assert.ok(comparePriority('Emergency', 'Urgent') > 0));
test('UT-21 Urgent outranks Routine', () => assert.ok(comparePriority('Urgent', 'Routine') > 0));
test('UT-22 Emergency outranks Routine', () => assert.ok(comparePriority('Emergency', 'Routine') > 0));
test('UT-23 Routine is lower than Emergency', () => assert.ok(comparePriority('Routine', 'Emergency') < 0));
test('UT-24 equal priorities compare as equal', () => assert.strictEqual(comparePriority('Urgent', 'Urgent'), 0));
test('UT-25 unknown priority has rank 0', () => assert.strictEqual(rank('Critical'), 0));
test('UT-26 Pediatrics patient needs the Pediatric ward', () =>
  assert.deepStrictEqual(suitableWards('Pediatrics', 'Routine'), ['Pediatric']));
test('UT-27 Emergency adult prefers ICU then General', () =>
  assert.deepStrictEqual(suitableWards('Cardiology', 'Emergency'), ['ICU', 'General']));
test('UT-28 Urgent adult uses the General ward', () =>
  assert.deepStrictEqual(suitableWards('Neurology', 'Urgent'), ['General']));
test('UT-29 one free bed, none reserved (boundary)', () => assert.strictEqual(usableCount(1, 0), 1));
test('UT-30 last free bed is reserved (boundary)', () => assert.strictEqual(usableCount(1, 1), 0));
test('UT-31 two free beds, one reserved', () => assert.strictEqual(usableCount(2, 1), 1));
test('UT-32 usable count never goes negative', () => assert.strictEqual(usableCount(0, 3), 0));
