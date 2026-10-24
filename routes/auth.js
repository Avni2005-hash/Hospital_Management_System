const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const asyncHandler = require('../middleware/asyncHandler');
const router = express.Router();

router.get('/login', (req, res) => res.render('login', { error: null }));

router.post('/login', asyncHandler(async (req, res) => {
  const { username = '', password = '' } = req.body;
  if (!username.trim() || !password) {
    return res.render('login', { error: 'Enter your username and password.' });
  }
  const [rows] = await pool.query('SELECT * FROM users WHERE username=?', [username.trim()]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash))) {
    return res.render('login', { error: 'Incorrect username or password.' });
  }
  req.session.user = { id: u.id, username: u.username, role: u.role };
  res.redirect('/patients');
}));

// NFR-SEC-08: session is destroyed on logout
router.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));

module.exports = router;