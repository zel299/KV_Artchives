const { supabaseAdmin, supabaseForUser } = require('../config/supabase');

const ACCESS_COOKIE = 'kv_access';
const REFRESH_COOKIE = 'kv_refresh';

const COOKIE_OPTS = {
  httpOnly: true,                                  // not readable by JavaScript
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',   // HTTPS only in production
  maxAge: 1000 * 60 * 60 * 24 * 7,                 // 7 days
};

function setSession(res, session) {
  res.cookie(ACCESS_COOKIE, session.access_token, COOKIE_OPTS);
  res.cookie(REFRESH_COOKIE, session.refresh_token, COOKIE_OPTS);
}

function clearSession(res) {
  res.clearCookie(ACCESS_COOKIE);
  res.clearCookie(REFRESH_COOKIE);
}

/**
 * Runs on every request. If a valid session cookie is present, loads the
 * user and their profile (which carries the role) onto the request.
 *
 * Never blocks — routes that require a login use requireAuth below.
 */
async function attachUser(req, res, next) {
  req.user = null;
  res.locals.user = null;

  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) return next();

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      clearSession(res);
      return next();
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, contact_no, role')
      .eq('id', data.user.id)
      .single();

    if (profile) {
      req.user = profile;
      req.accessToken = token;
      // A client scoped to this user, so RLS applies to their queries.
      req.db = supabaseForUser(token);
      res.locals.user = profile;
    }
  } catch (err) {
    console.error('[auth] attachUser failed:', err.message);
    clearSession(res);
  }

  next();
}

/** Gate for customer pages. Sends guests to login, remembering where they were headed. */
function requireAuth(req, res, next) {
  if (!req.user) {
    const next_ = encodeURIComponent(req.originalUrl);
    return res.redirect(`/login?next=${next_}`);
  }
  next();
}

/**
 * Gate for admin pages.
 *
 * The role is read from the profiles table, not from anything the browser
 * sends, so a customer cannot reach admin routes by typing the URL.
 */
function requireAdmin(req, res, next) {
  if (!req.user) return res.redirect('/admin/login');

  if (req.user.role !== 'admin') {
    return res.status(403).render('customer/error', {
      title: 'Access denied',
      status: 403,
      message: 'You do not have permission to view this page.',
    });
  }
  next();
}

/** Keeps logged-in users away from the login and signup pages. */
function redirectIfAuthed(req, res, next) {
  if (req.user) {
    return res.redirect(req.user.role === 'admin' ? '/admin' : '/');
  }
  next();
}

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  setSession,
  clearSession,
  attachUser,
  requireAuth,
  requireAdmin,
  redirectIfAuthed,
};
