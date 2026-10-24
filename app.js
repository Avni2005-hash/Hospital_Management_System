require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true },
}));
app.use((req, res, next) => { res.locals.user = req.session.user || null; next(); });

app.use('/', require('./routes/auth'));
app.use('/patients', require('./routes/patients'));
app.use('/allocations', require('./routes/allocations'));
app.get('/', (req, res) => res.redirect(req.session.user ? '/patients' : '/login'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { message: 'Something went wrong. Please try again.' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Running at http://localhost:${port}`));
