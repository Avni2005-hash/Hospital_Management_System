const express = require('express');
const { requireLogin, requireRole } = require('../middleware/auth');
const { validatePatient, DEPARTMENTS, PRIORITIES, GENDERS } = require('../services/validation');
const svc = require('../services/patientService');
const asyncHandler = require('../middleware/asyncHandler');
const router = express.Router();

const formData = (extra = {}) => ({
  departments: DEPARTMENTS, priorities: PRIORITIES, genders: GENDERS,
  errors: {}, values: {}, warning: null, ...extra,
});

router.get('/', requireLogin, asyncHandler(async (req, res) => {
  res.render('patients', { patients: await svc.listPatients(), success: req.query.success || null });
}));

// REQ-PR-01 / PR-05: only reception and admin can register
router.get('/new', requireRole('reception', 'admin'), (req, res) => {
  res.render('register', formData());
});

router.post('/new', requireRole('reception', 'admin'), asyncHandler(async (req, res) => {
  const { errors, clean, valid } = validatePatient(req.body);
  if (!valid) return res.status(400).render('register', formData({ errors, values: req.body }));

  if (await svc.findActiveDuplicate(clean)) {
    return res.status(409).render('register', formData({
      values: req.body,
      warning: 'An active patient with the same name, date of birth and contact number already exists.',
    }));
  }
  const id = await svc.createPatient(clean, req.session.user.id);
  res.redirect(`/patients?success=${encodeURIComponent(`Patient registered successfully (ID ${id}).`)}`);
}));

module.exports = router;
