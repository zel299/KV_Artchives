const { supabaseAnon, supabaseAdmin, SUPABASE_URL } = require('../config/supabase');
const { setSession, clearSession } = require('../middleware/auth');

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

  // TODO (Phase 5): merge any guest cart into this account here.

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
// Password reset
// ---------------------------------------------------------------

function showForgot(req, res) {
  res.render('customer/forgot-password', { title: 'Forgot password', sent: false, error: null });
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
  res.render('customer/forgot-password', { title: 'Forgot password', sent: true, error: null });
}

function showReset(req, res) {
  res.render('customer/reset-password', { title: 'Set a new password', error: null });
}

async function doReset(req, res) {
  const { access_token, password, confirm_password } = req.body;

  const fail = (msg) =>
    res.status(400).render('customer/reset-password', {
      title: 'Set a new password',
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

  res.render('customer/reset-done', { title: 'Password updated' });
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

  setSession(res, data.session);
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
  showAdminLogin,
  doAdminLogin,
};