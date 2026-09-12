const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { redirectIfAuthed, requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/authController');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).render('customer/login', {
      title: 'Log in',
      layout: false,
      error: 'Too many attempts. Please wait a few minutes before trying again.',
      next: req.body.next || '',
    });
  },
});

// --- Customer auth ---
router.get('/login', redirectIfAuthed, ctrl.showLogin);
router.post('/login', authLimiter, ctrl.doLogin);

router.get('/signup', redirectIfAuthed, ctrl.showSignup);
router.post('/signup', authLimiter, ctrl.doSignup);

router.get('/logout', ctrl.doLogout);
router.post('/logout', ctrl.doLogout);

router.get('/account/password', requireAuth, ctrl.showChangePassword);
router.post('/account/password', requireAuth, authLimiter, ctrl.doChangePassword);
// --- Google OAuth ---
router.get('/auth/google', ctrl.googleStart);
router.get('/auth/callback', ctrl.oauthCallback);
router.post('/auth/session', ctrl.oauthSession);

// --- Password reset ---
router.get('/forgot-password', redirectIfAuthed, ctrl.showForgot);
router.post('/forgot-password', authLimiter, ctrl.doForgot);
router.get('/reset-password', ctrl.showReset);
router.post('/reset-password', authLimiter, ctrl.doReset);

// --- Admin auth (separate entry point, same underlying accounts) ---
router.get('/admin/login', redirectIfAuthed, ctrl.showAdminLogin);
router.post('/admin/login', authLimiter, ctrl.doAdminLogin);

module.exports = router;