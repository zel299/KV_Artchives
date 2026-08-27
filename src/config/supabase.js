const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !PUBLISHABLE_KEY || !SECRET_KEY) {
  console.error('\n[config] Missing Supabase environment variables.');
  console.error('Check that .env exists and contains SUPABASE_URL,');
  console.error('SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY.\n');
  process.exit(1);
}

/**
 * Admin client — uses the SECRET key.
 *
 * This bypasses Row Level Security entirely, so it must never be exposed
 * to the browser. Use it only for trusted server-side work: creating
 * orders, confirming payments, adjusting stock, sweeping expired orders.
 */
const supabaseAdmin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Anonymous client — uses the PUBLISHABLE key.
 *
 * Respects RLS. Used for auth calls (sign up, sign in, password reset)
 * and for reads that should follow the same rules a browser would.
 */
const supabaseAnon = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Build a client scoped to a specific logged-in user's access token.
 *
 * Queries made with this client run as that user, so RLS applies exactly
 * as it would in the browser. This is the safest way to read or write
 * data on behalf of a customer: even if a route forgets a check, the
 * database will not return someone else's rows.
 */
function supabaseForUser(accessToken) {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

module.exports = {
  supabaseAdmin,
  supabaseAnon,
  supabaseForUser,
  SUPABASE_URL,
  PUBLISHABLE_KEY,
};
