// Creates the two login users with hashed passwords. Run once: npm run seed
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

(async () => {
  const users = [
    ['reception1', 'Reception@123', 'reception'],
    ['admin1', 'Admin@123', 'admin'],
  ];
  for (const [u, p, r] of users) {
    const hash = await bcrypt.hash(p, 10);
    await pool.query(
      'INSERT INTO users (username, password_hash, role) VALUES (?,?,?) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash)',
      [u, hash, r]
    );
  }
  console.log('Users created: reception1 / Reception@123 and admin1 / Admin@123');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
