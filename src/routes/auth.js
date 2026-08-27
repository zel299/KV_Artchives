const express = require('express');
const router = express.Router();
const { redirectIfAuthed } = require('../middleware/auth');
const ctrl = require('../controllers/authController');

// --- Customer auth ---
router.get('/login', redirectIfAuthed, ctrl.showLogin);
router.post('/login', ctrl.doLogin);

router.get('/signup', redirectIfAuthed, ctrl.showSignup);
router.post('/signup', ctrl.doSignup);

router.get('/logout', ctrl.doLogout);
router.post('/logout', ctrl.doLogout);

// --- Google OAuth ---
router.get('/auth/google', ctrl.googleStart);
router.get('/auth/callback', ctrl.oauthCallback);
router.post('/auth/session', ctrl.oauthSession);

// --- Password reset ---
router.get('/forgot-password', redirectIfAuthed, ctrl.showForgot);
router.post('/forgot-password', ctrl.doForgot);
router.get('/reset-password', ctrl.showReset);
router.post('/reset-password', ctrl.doReset);

// --- Admin auth (separate entry point, same underlying accounts) ---
router.get('/admin/login', redirectIfAuthed, ctrl.showAdminLogin);
router.post('/admin/login', ctrl.doAdminLogin);

module.exports = router;
