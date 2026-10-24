// Pure validation logic (no database) so it can be unit tested. REQ-PR-03, REQ-PR-04
const DEPARTMENTS = ['Cardiology', 'Orthopedics', 'Neurology', 'Pediatrics', 'General Medicine'];
const PRIORITIES = ['Emergency', 'Urgent', 'Routine'];
const GENDERS = ['Male', 'Female', 'Other'];
const NAME_RE = /^[A-Za-z][A-Za-z '\-]*$/;
const MAX_NAME = 50;
const MAX_AGE = 120;

function validateName(value, label, errors, key) {
  if (!value) return (errors[key] = `${label} is required.`);
  if (value.length > MAX_NAME) return (errors[key] = `${label} must be at most ${MAX_NAME} characters.`);
  if (!NAME_RE.test(value)) return (errors[key] = `${label} may contain only letters, spaces, hyphens and apostrophes.`);
}

function validateDob(value, errors, today) {
  if (!value) return (errors.dob = 'Date of birth is required.');
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  const valid = d && d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  if (!valid) return (errors.dob = 'Enter a valid date of birth.');
  const t = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  if (d > t) return (errors.dob = 'Date of birth cannot be in the future.');
  const oldest = new Date(Date.UTC(t.getUTCFullYear() - MAX_AGE, t.getUTCMonth(), t.getUTCDate()));
  if (d < oldest) return (errors.dob = `Date of birth cannot be more than ${MAX_AGE} years ago.`);
}

function validatePatient(input, today = new Date()) {
  const clean = {
    first_name: (input.first_name || '').trim(),
    last_name: (input.last_name || '').trim(),
    dob: (input.dob || '').trim(),
    gender: (input.gender || '').trim(),
    contact: (input.contact || '').trim(),
    department: (input.department || '').trim(),
    priority: (input.priority || '').trim(),
  };
  const errors = {};

  validateName(clean.first_name, 'First name', errors, 'first_name');
  validateName(clean.last_name, 'Last name', errors, 'last_name');
  validateDob(clean.dob, errors, today);

  if (!clean.gender) errors.gender = 'Gender is required.';
  else if (!GENDERS.includes(clean.gender)) errors.gender = 'Select a valid gender.';

  if (!clean.contact) errors.contact = 'Contact number is required.';
  else if (!/^\d{10}$/.test(clean.contact)) errors.contact = 'Contact number must be exactly 10 digits.';

  if (!clean.department) errors.department = 'Department is required.';
  else if (!DEPARTMENTS.includes(clean.department)) errors.department = 'Select a valid department.';

  if (!clean.priority) errors.priority = 'Priority is required.';
  else if (!PRIORITIES.includes(clean.priority)) errors.priority = 'Priority must be Emergency, Urgent or Routine.';

  return { errors, clean, valid: Object.keys(errors).length === 0 };
}

module.exports = { validatePatient, DEPARTMENTS, PRIORITIES, GENDERS, MAX_NAME };
