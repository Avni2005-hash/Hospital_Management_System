-- Hospital Resources Allocation and Management System
CREATE DATABASE IF NOT EXISTS hospital_ras;
USE hospital_ras;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role ENUM('reception','admin') NOT NULL
);

-- Module 1 (SRS 4.1)
CREATE TABLE IF NOT EXISTS patients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  dob DATE NOT NULL,
  gender ENUM('Male','Female','Other') NOT NULL,
  contact CHAR(10) NOT NULL,
  department ENUM('Cardiology','Orthopedics','Neurology','Pediatrics','General Medicine') NOT NULL,
  priority ENUM('Emergency','Urgent','Routine') NOT NULL,
  status ENUM('Active','Discharged') NOT NULL DEFAULT 'Active',
  registered_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (registered_by) REFERENCES users(id)
);

-- Resource data (Story 9) - used by Module 2
CREATE TABLE IF NOT EXISTS doctors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  specialization ENUM('Cardiology','Orthopedics','Neurology','Pediatrics','General Medicine') NOT NULL,
  status ENUM('Available','Allocated','Unavailable') NOT NULL DEFAULT 'Available'
);

CREATE TABLE IF NOT EXISTS beds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bed_number VARCHAR(10) NOT NULL UNIQUE,
  ward_type ENUM('General','ICU','Pediatric') NOT NULL,
  status ENUM('Available','Occupied','Maintenance') NOT NULL DEFAULT 'Available'
);

CREATE TABLE IF NOT EXISTS equipment (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status ENUM('Available','InUse','Maintenance') NOT NULL DEFAULT 'Available'
);

-- Module 2 (SRS 4.5) - statuses follow your State Diagram
CREATE TABLE IF NOT EXISTS allocations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  doctor_id INT NULL,
  bed_id INT NULL,
  equipment_id INT NULL,
  status ENUM('Requested','PendingUnavailable','Confirmed','Active','Completed','Cancelled') NOT NULL DEFAULT 'Requested',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (doctor_id) REFERENCES doctors(id),
  FOREIGN KEY (bed_id) REFERENCES beds(id),
  FOREIGN KEY (equipment_id) REFERENCES equipment(id)
);

-- Sample resource data
INSERT INTO doctors (name, specialization) VALUES
 ('Dr. Mehta','Cardiology'),('Dr. Rao','Orthopedics'),('Dr. Iyer','Neurology'),
 ('Dr. Kulkarni','Pediatrics'),('Dr. Singh','General Medicine');
INSERT INTO beds (bed_number, ward_type) VALUES
 ('G-01','General'),('G-02','General'),('G-03','General'),('G-04','General'),('G-05','General'),
 ('I-01','ICU'),('I-02','ICU'),('I-03','ICU'),('P-01','Pediatric'),('P-02','Pediatric');
INSERT INTO equipment (name, type) VALUES
 ('ECG Machine','Cardiac'),('X-Ray Unit','Imaging'),('MRI Scanner','Imaging'),
 ('Ventilator','Life Support'),('Defibrillator','Cardiac');
