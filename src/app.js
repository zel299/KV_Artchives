require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const expressLayouts = require('express-ejs-layouts');

const config = require('./config');
const { attachUser } = require('./middleware/auth');

const app = express();

// --- View engine ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/customer');

// --- Core middleware ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Reads the session cookie and puts the current user on req.user and
// res.locals.user, so every view can check who is logged in.
app.use(attachUser);

// Helpers available inside all EJS templates.
const money = require('./utils/money');
app.use((req, res, next) => {
  res.locals.formatPeso = money.formatPeso;
  res.locals.formatPlain = money.formatPlain;
  res.locals.currentPath = req.path;
  next();
});

// --- Routes ---
app.get('/health', (req, res) => {
  res.json({ ok: true, env: config.env });
});

app.use('/', require('./routes/auth'));
app.use('/admin', require('./routes/admin'));

// Temporary landing page until Phase 5 builds the real catalog.
app.get('/', (req, res) => {
  res.render('customer/home', { title: 'KV Artchives' });
});

// --- 404 ---
app.use((req, res) => {
  res.status(404).render('customer/error', {
    title: 'Not found',
    status: 404,
    message: 'That page does not exist.',
  });
});

// --- Error handler ---
app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(500).render('customer/error', {
    title: 'Something went wrong',
    status: 500,
    message:
      config.env === 'development'
        ? err.message
        : 'Something went wrong on our end. Please try again.',
  });
});

module.exports = app;
