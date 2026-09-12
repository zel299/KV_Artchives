const { setSession, clearSession } = require('../middleware/auth');
const { supabaseAnon, supabaseAdmin, supabaseForUser, SUPABASE_URL } = require('../config/supabase');
const cartService = require('../services/cartService');

function baseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

// ---------------------------------------------------------------
// Customer login
// ---------------------------------------------------------------

function showLogin(req, res) {
  res.render('customer/login', {
    title: 'Log in',
    layout: false,
    error: null,
    next: req.query.next || '',
  });
}

async function doLogin(req, res) {
  const { email, password } = req.body;
  const nextUrl = req.body.next || '/';

  if (!email || !password) {
    return res.status(400).render('customer/login', {
      title: 'Log in',
      layout: false,
      error: 'Enter your email and password.',
      next: nextUrl,
    });
  }

  const { data, error } = await supabaseAnon.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data?.session) {
    // Deliberately vague: do not reveal whether the email exists.
    return res.status(401).render('customer/login', {
      title: 'Log in',
      layout: false,
      error: 'That email and password do not match.',
      next: nextUrl,
    });
  }

  setSession(res, data.session);

  try {
    const db = supabaseForUser(data.session.access_token);
    await cartService.mergeGuestCart(db, data.user.id, req, res);
  } catch (err) {
    console.error("[cart] merge failed:", err.message);
  }

  res.redirect(nextUrl.startsWith('/') ? nextUrl : '/');
}

// ---------------------------------------------------------------
// Signup
// ---------------------------------------------------------------

function showSignup(req, res) {
  res.render('customer/signup', {
    title: 'Create account',
    layout: false,
    error: null,
    values: {},
  });
}

async function doSignup(req, res) {
  const { full_name, email, password, confirm_password } = req.body;
  const values = { full_name, email };

  const fail = (msg, status = 400) =>
    res.status(status).render('customer/signup', {
      title: 'Create account',
      layout: false,
      error: msg,
      values,
    });

  if (!full_name || !email || !password) return fail('Fill in every field.');
  if (password.length < 8) return fail('Use at least 8 characters for your password.');
  if (password !== confirm_password) return fail('Those passwords do not match.');

  const { data, error } = await supabaseAnon.auth.signUp({
    email,
    password,
    options: {
      data: { full_name },
      emailRedirectTo: `${baseUrl(req)}/auth/callback`,
    },
  });

  if (error) return fail(error.message);

  // The handle_new_user trigger creates the profile row automatically.
  // If email confirmation is on, there is no session yet.
  if (data.session) {
    setSession(res, data.session);
    return res.redirect('/');
  }

  res.render('customer/check-email', {
    title: 'Check your email',
    pageCss: 'auth-pages',
    email,
  });
}

// ---------------------------------------------------------------
// Logout
// ---------------------------------------------------------------

function doLogout(req, res) {
  clearSession(res);
  res.redirect('/');
}

// ---------------------------------------------------------------
// Google OAuth
// ---------------------------------------------------------------

async function googleStart(req, res) {
  const { data, error } = await supabaseAnon.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${baseUrl(req)}/auth/callback` },
  });

  if (error || !data?.url) {
    return res.status(500).render('customer/error', {
      title: 'Sign-in failed',
      status: 500,
      message: 'Could not start Google sign-in. Please try again.',
    });
  }

  res.redirect(data.url);
}

/**
 * Supabase returns the session in the URL fragment (#access_token=...),
 * which never reaches the server. This page reads it in the browser and
 * posts it back so the session can be stored in an httpOnly cookie.
 */
function oauthCallback(req, res) {
  res.render('customer/oauth-callback', { title: 'Signing you in…', layout: false });
}

/**
 * Receives the tokens posted by the callback page and stores them in
 * httpOnly cookies, so the browser never keeps them in JavaScript.
 */
async function oauthSession(req, res) {
  const { access_token, refresh_token } = req.body;

  if (!access_token || !refresh_token) return res.redirect('/login');

  const { data, error } = await supabaseAdmin.auth.getUser(access_token);
  if (error || !data?.user) return res.redirect('/login');

  setSession(res, { access_token, refresh_token });

  // Google sign-ups arrive with no full_name on the profile; backfill it.
  const meta = data.user.user_metadata || {};
  const name = meta.full_name || meta.name;
  if (name) {
    await supabaseAdmin
      .from('profiles')
      .update({ full_name: name })
      .eq('id', data.user.id)
      .is('full_name', null);
  }

  res.redirect('/');
}

// ---------------------------------------------------------------
// Password reset (not logged in)
// ---------------------------------------------------------------

function showForgot(req, res) {
  res.render('customer/forgot-password', {
    title: 'Forgot password',
    pageCss: 'auth-pages',
    sent: false,
    error: null,
  });
}

async function doForgot(req, res) {
  const { email } = req.body;

  if (email) {
    await supabaseAnon.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl(req)}/reset-password`,
    });
  }

  // Always report success, so this page cannot be used to discover
  // which email addresses have accounts.
  res.render('customer/forgot-password', {
    title: 'Forgot password',
    pageCss: 'auth-pages',
    sent: true,
    error: null,
  });
}

function showReset(req, res) {
  res.render('customer/reset-password', {
    title: 'Set a new password',
    pageCss: 'auth-pages',
    error: null,
  });
}

async function doReset(req, res) {
  const { access_token, password, confirm_password } = req.body;

  const fail = (msg) =>
    res.status(400).render('customer/reset-password', {
      title: 'Set a new password',
      pageCss: 'auth-pages',
      error: msg,
    });

  if (!access_token) return fail('That reset link has expired. Request a new one.');
  if (!password || password.length < 8) return fail('Use at least 8 characters.');
  if (password !== confirm_password) return fail('Those passwords do not match.');

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(access_token);
  if (userErr || !userData?.user) return fail('That reset link has expired. Request a new one.');

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userData.user.id, {
    password,
  });
  if (error) return fail(error.message);

  res.render('customer/reset-done', {
    title: 'Password updated',
    pageCss: 'auth-pages',
  });
}

// ---------------------------------------------------------------
// Change password (logged in)
// ---------------------------------------------------------------

function showChangePassword(req, res) {
  res.render('customer/change-password', {
    title: 'Change password',
    pageCss: 'account-settings',
    error: null,
    done: false,
  });
}

/**
 * Supabase has no "verify this password" call, so the current password is
 * checked by attempting a sign-in with it. Without that, anyone reaching an
 * unlocked browser could change the password without knowing the old one.
 *
 * The session is cleared afterwards: changing a password should end every
 * session, including any the owner did not start.
 */
async function doChangePassword(req, res, next) {
  const { current_password, password, confirm_password } = req.body;

  const fail = (msg) =>
    res.status(400).render('customer/change-password', {
      title: 'Change password',
      pageCss: 'account-settings',
      error: msg,
      done: false,
    });

  try {
    if (!current_password) return fail('Enter your current password.');
    if (!password || password.length < 8) return fail('Use at least 8 characters.');
    if (password !== confirm_password) return fail('Those passwords do not match.');
    if (password === current_password) return fail('That is your current password.');

    const { error: checkErr } = await supabaseAnon.auth.signInWithPassword({
      email: req.user.email,
      password: current_password,
    });

    if (checkErr) return fail('Your current password is not correct.');

    const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
      password,
    });

    if (error) return fail(error.message);

    clearSession(res);

    res.render('customer/change-password', {
      title: 'Password updated',
      pageCss: 'account-settings',
      error: null,
      done: true,
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------
// Admin login
// ---------------------------------------------------------------

function showAdminLogin(req, res) {
  res.render('admin/login', { title: 'Admin portal', error: null, layout: false });
}

async function doAdminLogin(req, res) {
  const { email, password } = req.body;

  const fail = (msg) =>
    res.status(401).render('admin/login', {
      title: 'Admin portal',
      error: msg,
      layout: false,
    });

  if (!email || !password) return fail('Enter your email and password.');

  const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
  if (error || !data?.session) return fail('That email and password do not match.');

  // Signing in is not enough — the account must actually hold the admin role.
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return fail('That account does not have admin access.');
  }

  // Admin sessions are shorter than customer ones: an admin session can
  // confirm payments and cancel orders, so it should not last a week.
  setSession(res, data.session, true);
  res.redirect('/admin');
}

module.exports = {
  showLogin,
  doLogin,
  showSignup,
  doSignup,
  doLogout,
  googleStart,
  oauthCallback,
  oauthSession,
  showForgot,
  doForgot,
  showReset,
  doReset,
  showChangePassword,
  doChangePassword,
  showAdminLogin,
  doAdminLogin,
};