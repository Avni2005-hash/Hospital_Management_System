const pool = require('../config/db');

// Duplicate = an ACTIVE patient with same name, DOB and contact (SRS 4.1 exception flow)
async function findActiveDuplicate(p) {
  const [rows] = await pool.query(
    `SELECT id FROM patients
     WHERE status='Active' AND LOWER(first_name)=LOWER(?) AND LOWER(last_name)=LOWER(?)
       AND dob=? AND contact=? LIMIT 1`,
    [p.first_name, p.last_name, p.dob, p.contact]
  );
  return rows[0] || null;
}

async function createPatient(p, userId) {
  const [result] = await pool.query(
    `INSERT INTO patients (first_name,last_name,dob,gender,contact,department,priority,registered_by)
     VALUES (?,?,?,?,?,?,?,?)`,
    [p.first_name, p.last_name, p.dob, p.gender, p.contact, p.department, p.priority, userId]
  );
  return result.insertId;
}

async function listPatients() {
  const [rows] = await pool.query(
    `SELECT id, first_name, last_name, DATE_FORMAT(dob,'%Y-%m-%d') AS dob, gender, contact,
            department, priority, status
     FROM patients
     ORDER BY FIELD(priority,'Emergency','Urgent','Routine'), created_at DESC`
  );
  return rows;
}

module.exports = { findActiveDuplicate, createPatient, listPatients };
