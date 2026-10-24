const test = require('node:test');
const assert = require('node:assert');
const { validatePatient } = require('../services/validation');

const TODAY = new Date(2026, 6, 25); // fixed date so tests are repeatable
const good = {
  first_name: 'Ravi', last_name: 'Sharma', dob: '1990-05-10', gender: 'Male',
  contact: '9876543210', department: 'Cardiology', priority: 'Urgent',
};
const check = (override) => validatePatient({ ...good, ...override }, TODAY);

test('UT-01 valid patient passes', () => assert.ok(check({}).valid));
test('UT-02 missing first name fails', () => assert.ok(check({ first_name: '' }).errors.first_name));
test('UT-03 first name 1 char passes (boundary)', () => assert.ok(check({ first_name: 'A' }).valid));
test('UT-04 first name 50 chars passes (boundary)', () => assert.ok(check({ first_name: 'A'.repeat(50) }).valid));
test('UT-05 first name 51 chars fails (boundary)', () => assert.ok(check({ first_name: 'A'.repeat(51) }).errors.first_name));
test('UT-06 name with digits fails', () => assert.ok(check({ last_name: 'Sh4rma' }).errors.last_name));
test('UT-07 DOB today passes (boundary)', () => assert.ok(check({ dob: '2026-07-25' }).valid));
test('UT-08 DOB tomorrow fails (boundary)', () => assert.ok(check({ dob: '2026-07-26' }).errors.dob));
test('UT-09 impossible date fails', () => assert.ok(check({ dob: '2024-02-30' }).errors.dob));
test('UT-10 DOB over 120 years ago fails', () => assert.ok(check({ dob: '1900-01-01' }).errors.dob));
test('UT-11 contact 9 digits fails (boundary)', () => assert.ok(check({ contact: '987654321' }).errors.contact));
test('UT-12 contact 10 digits passes (boundary)', () => assert.ok(check({ contact: '9876543210' }).valid));
test('UT-13 contact 11 digits fails (boundary)', () => assert.ok(check({ contact: '98765432101' }).errors.contact));
test('UT-14 contact with letters fails', () => assert.ok(check({ contact: '12ab' }).errors.contact));
test('UT-15 each valid priority passes', () => {
  for (const p of ['Emergency', 'Urgent', 'Routine']) assert.ok(check({ priority: p }).valid);
});
test('UT-16 invalid priority fails', () => assert.ok(check({ priority: 'Critical' }).errors.priority));
test('UT-17 missing priority fails', () => assert.ok(check({ priority: '' }).errors.priority));
test('UT-18 invalid department fails', () => assert.ok(check({ department: 'Dental' }).errors.department));
test('UT-19 invalid gender fails', () => assert.ok(check({ gender: 'X' }).errors.gender));
