const pool = require('../config/db');
const { suitableWards, usableCount } = require('./priority');

class UserError extends Error {}

const ALLOC_SELECT = `
  SELECT a.id, a.patient_id, a.status, DATE_FORMAT(a.created_at,'%Y-%m-%d %H:%i') AS created,
         p.first_name, p.last_name, p.priority, p.department,
         d.name AS doctor_name, b.bed_number, b.ward_type, e.name AS equipment_name
  FROM allocations a
  JOIN patients p ON p.id = a.patient_id
  LEFT JOIN doctors d ON d.id = a.doctor_id
  LEFT JOIN beds b ON b.id = a.bed_id
  LEFT JOIN equipment e ON e.id = a.equipment_id`;

async function getActivePatient(id, db = pool) {
  const [rows] = await db.query("SELECT * FROM patients WHERE id=? AND status='Active'", [id]);
  return rows[0] || null;
}

// Higher-priority patients waiting in the pending queue who could use the same wards (REQ-PA-04)
async function countHigherWaiting(db, patient) {
  const [rows] = await db.query(
    `SELECT DISTINCT p.id, p.department, p.priority
       FROM allocations a JOIN patients p ON p.id = a.patient_id
      WHERE a.status='PendingUnavailable' AND p.id <> ?
        AND FIELD(p.priority,'Emergency','Urgent','Routine') < FIELD(?,'Emergency','Urgent','Routine')`,
    [patient.id, patient.priority]
  );
  const mine = suitableWards(patient.department, patient.priority);
  return rows.filter((r) => suitableWards(r.department, r.priority).some((w) => mine.includes(w))).length;
}

// Doctor first, then bed, then equipment (SRS 4.5 main flow)
async function getSuggestions(patient, db = pool) {
  const wards = suitableWards(patient.department, patient.priority);
  const [doctors] = await db.query(
    "SELECT * FROM doctors WHERE specialization=? AND status='Available' ORDER BY name", [patient.department]);
  const [freeBeds] = await db.query(
    "SELECT * FROM beds WHERE status='Available' AND ward_type IN (?)", [wards]);
  freeBeds.sort((a, b) =>
    wards.indexOf(a.ward_type) - wards.indexOf(b.ward_type) || a.bed_number.localeCompare(b.bed_number));
  const [equipment] = await db.query("SELECT * FROM equipment WHERE status='Available' ORDER BY name");
  const [equipmentAll] = await db.query('SELECT * FROM equipment ORDER BY name');
  const reserved = await countHigherWaiting(db, patient);
  const usable = usableCount(freeBeds.length, reserved);
  return {
    doctors,
    beds: usable > 0 ? freeBeds : [],
    bedsFree: freeBeds.length,
    equipment,
    equipmentAll,
  };
}

async function openAllocationFor(patientId, db = pool) {
  const [rows] = await db.query(
    `SELECT * FROM allocations WHERE patient_id=? AND status IN ('Requested','PendingUnavailable','Confirmed')
     ORDER BY id DESC LIMIT 1`, [patientId]);
  return rows[0] || null;
}

// Creates a Requested allocation after re-checking the choices against current availability
async function createRequest(patient, sel) {
  const open = await openAllocationFor(patient.id);
  if (open && open.status === 'Confirmed') throw new UserError('This patient already has a confirmed allocation.');
  const s = await getSuggestions(patient);
  const doctorId = Number(sel.doctor_id);
  const bedId = Number(sel.bed_id);
  const equipId = sel.equipment_id ? Number(sel.equipment_id) : null;
  if (!s.doctors.some((d) => d.id === doctorId)) throw new UserError('Select an available doctor from the list.');
  if (!s.beds.some((b) => b.id === bedId)) throw new UserError('Select an available bed from the list.');
  if (equipId !== null && !s.equipment.some((e) => e.id === equipId)) {
    throw new UserError('The selected equipment is not available.');
  }
  if (open) { // reuse the queue entry so the patient keeps their place
    await pool.query(
      "UPDATE allocations SET doctor_id=?, bed_id=?, equipment_id=?, status='Requested' WHERE id=?",
      [doctorId, bedId, equipId, open.id]);
    return open.id;
  }
  const [r] = await pool.query(
    "INSERT INTO allocations (patient_id, doctor_id, bed_id, equipment_id, status) VALUES (?,?,?,?, 'Requested')",
    [patient.id, doctorId, bedId, equipId]);
  return r.insertId;
}

async function addToPending(patient) {
  const open = await openAllocationFor(patient.id);
  if (open && open.status === 'Confirmed') throw new UserError('This patient already has a confirmed allocation.');
  if (open && open.status === 'PendingUnavailable') throw new UserError('This patient is already in the pending queue.');
  if (open) {
    await pool.query(
      "UPDATE allocations SET status='PendingUnavailable', doctor_id=NULL, bed_id=NULL, equipment_id=NULL WHERE id=?",
      [open.id]);
    return open.id;
  }
  const [r] = await pool.query(
    "INSERT INTO allocations (patient_id, status) VALUES (?, 'PendingUnavailable')", [patient.id]);
  return r.insertId;
}

// Verifies availability again inside a transaction, then updates every resource (BR-08, NFR-SAF-04)
async function confirmAllocation(id) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [aRows] = await conn.query('SELECT * FROM allocations WHERE id=? FOR UPDATE', [id]);
    const alloc = aRows[0];
    if (!alloc || alloc.status !== 'Requested') throw new UserError('This request is no longer open for confirmation.');
    const [pRows] = await conn.query('SELECT * FROM patients WHERE id=?', [alloc.patient_id]);
    const patient = pRows[0];
    const problems = [];

    const [dRows] = await conn.query('SELECT * FROM doctors WHERE id=? FOR UPDATE', [alloc.doctor_id]);
    const doctor = dRows[0];
    if (!doctor || doctor.status !== 'Available' || doctor.specialization !== patient.department) {
      problems.push('The selected doctor is no longer available.');
    }

    const wards = suitableWards(patient.department, patient.priority);
    const [bRows] = await conn.query('SELECT * FROM beds WHERE id=? FOR UPDATE', [alloc.bed_id]);
    const bed = bRows[0];
    if (!bed || bed.status !== 'Available' || !wards.includes(bed.ward_type)) {
      problems.push('The selected bed is no longer available.');
    } else {
      const [cnt] = await conn.query(
        "SELECT COUNT(*) AS n FROM beds WHERE status='Available' AND ward_type IN (?)", [wards]);
      const reserved = await countHigherWaiting(conn, patient);
      if (usableCount(Number(cnt[0].n), reserved) <= 0) {
        problems.push('The last free bed is reserved for a higher-priority patient who is waiting.');
      }
    }

    if (alloc.equipment_id) {
      const [eRows] = await conn.query('SELECT * FROM equipment WHERE id=? FOR UPDATE', [alloc.equipment_id]);
      if (!eRows[0] || eRows[0].status !== 'Available') problems.push('The selected equipment is no longer available.');
    }

    if (problems.length) { // prevent the allocation, keep the request in the pending queue
      await conn.query(
        "UPDATE allocations SET status='PendingUnavailable', doctor_id=NULL, bed_id=NULL, equipment_id=NULL WHERE id=?", [id]);
      await conn.commit();
      return { ok: false, problems, patientId: patient.id };
    }

    await conn.query("UPDATE doctors SET status='Allocated' WHERE id=?", [alloc.doctor_id]);
    await conn.query("UPDATE beds SET status='Occupied' WHERE id=?", [alloc.bed_id]);
    if (alloc.equipment_id) await conn.query("UPDATE equipment SET status='InUse' WHERE id=?", [alloc.equipment_id]);
    await conn.query("UPDATE allocations SET status='Confirmed' WHERE id=?", [id]);
    await conn.commit();
    return { ok: true, patientId: patient.id };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function cancelAllocation(id) {
  const [r] = await pool.query(
    "UPDATE allocations SET status='Cancelled' WHERE id=? AND status IN ('Requested','PendingUnavailable')", [id]);
  if (r.affectedRows === 0) throw new UserError('Only a requested or pending allocation can be cancelled.');
}

// Releases the doctor, bed and equipment (REQ-BM-06)
async function completeAllocation(id) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM allocations WHERE id=? FOR UPDATE', [id]);
    const a = rows[0];
    if (!a || a.status !== 'Confirmed') throw new UserError('Only a confirmed allocation can be completed.');
    await conn.query("UPDATE doctors SET status='Available' WHERE id=?", [a.doctor_id]);
    await conn.query("UPDATE beds SET status='Available' WHERE id=?", [a.bed_id]);
    if (a.equipment_id) await conn.query("UPDATE equipment SET status='Available' WHERE id=?", [a.equipment_id]);
    await conn.query("UPDATE allocations SET status='Completed' WHERE id=?", [id]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function getAllocation(id) {
  const [rows] = await pool.query(`${ALLOC_SELECT} WHERE a.id=?`, [id]);
  return rows[0] || null;
}

async function listPatientsForAllocation() {
  const [rows] = await pool.query(
    `SELECT p.id, p.first_name, p.last_name, p.department, p.priority,
            (SELECT a.status FROM allocations a
              WHERE a.patient_id=p.id AND a.status IN ('Requested','PendingUnavailable','Confirmed')
              ORDER BY a.id DESC LIMIT 1) AS alloc_status
       FROM patients p WHERE p.status='Active'
      ORDER BY FIELD(p.priority,'Emergency','Urgent','Routine'), p.created_at`);
  return rows;
}

async function listPending() {
  const [rows] = await pool.query(
    `${ALLOC_SELECT} WHERE a.status='PendingUnavailable'
     ORDER BY FIELD(p.priority,'Emergency','Urgent','Routine'), a.created_at, a.id`);
  return rows;
}

async function listRecords() {
  const [rows] = await pool.query(
    `${ALLOC_SELECT} WHERE a.status IN ('Requested','Confirmed','Completed','Cancelled')
     ORDER BY a.id DESC LIMIT 50`);
  return rows;
}

module.exports = {
  UserError, getActivePatient, getSuggestions, createRequest, addToPending,
  confirmAllocation, cancelAllocation, completeAllocation, getAllocation,
  listPatientsForAllocation, listPending, listRecords,
};
