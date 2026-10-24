const express = require('express');
const { requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const svc = require('../services/allocationService');
const router = express.Router();

// BR-01: only authorized staff can allocate resources
const staff = requireRole('reception', 'admin');

const go = (res, type, msg, path = '/allocations') =>
  res.redirect(`${path}?${type}=${encodeURIComponent(msg)}`);

// Runs a handler; a UserError becomes a message on the page named by `back`
const run = (back, fn) => asyncHandler(async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e instanceof svc.UserError) return go(res, 'err', e.message, typeof back === 'function' ? back(req) : back);
    throw e;
  }
});

const patientOr404 = async (req) => {
  const patient = await svc.getActivePatient(Number(req.params.id));
  if (!patient) throw new svc.UserError('Patient not found or not active.');
  return patient;
};

router.get('/', staff, asyncHandler(async (req, res) => {
  const [patients, pending, records] = await Promise.all([
    svc.listPatientsForAllocation(), svc.listPending(), svc.listRecords(),
  ]);
  res.render('allocations', { patients, pending, records, ok: req.query.ok || null, err: req.query.err || null });
}));

// Story 4: show suitable available resources for a patient
router.get('/patient/:id', staff, run('/allocations', async (req, res) => {
  const patient = await patientOr404(req);
  const s = await svc.getSuggestions(patient);
  res.render('allocate', { patient, s, ok: req.query.ok || null, err: req.query.err || null });
}));

router.post('/patient/:id/review', staff, run((req) => `/allocations/patient/${req.params.id}`, async (req, res) => {
  const patient = await patientOr404(req);
  const id = await svc.createRequest(patient, req.body);
  res.redirect(`/allocations/${id}/review`);
}));

// Story 6: queue the request when resources are unavailable
router.post('/patient/:id/pending', staff, run((req) => `/allocations/patient/${req.params.id}`, async (req, res) => {
  const patient = await patientOr404(req);
  await svc.addToPending(patient);
  go(res, 'ok', 'Request added to the pending queue.');
}));

// Story 7: review, then confirm or cancel
router.get('/:id/review', staff, run('/allocations', async (req, res) => {
  const a = await svc.getAllocation(Number(req.params.id));
  if (!a || a.status !== 'Requested') throw new svc.UserError('This request is no longer open for confirmation.');
  res.render('review', { a });
}));

router.post('/:id/confirm', staff, run('/allocations', async (req, res) => {
  const r = await svc.confirmAllocation(Number(req.params.id));
  if (!r.ok) {
    return go(res, 'err', `${r.problems.join(' ')} Availability has been refreshed and the request is kept in the pending queue.`,
      `/allocations/patient/${r.patientId}`);
  }
  go(res, 'ok', 'Allocation confirmed. Doctor, bed and equipment status updated.');
}));

router.post('/:id/cancel', staff, run('/allocations', async (req, res) => {
  await svc.cancelAllocation(Number(req.params.id));
  go(res, 'ok', 'Request cancelled. No resources were changed.');
}));

router.post('/:id/complete', staff, run('/allocations', async (req, res) => {
  await svc.completeAllocation(Number(req.params.id));
  go(res, 'ok', 'Allocation completed. Resources are available again.');
}));

module.exports = router;
