require('dotenv').config();

const app = require('./app');
const config = require('./config');
const { supabaseAdmin } = require('./config/supabase');

async function verifySupabase() {
  const { error } = await supabaseAdmin.from('settings').select('id').limit(1);
  if (error) {
    console.error('\n[startup] Could not reach Supabase:', error.message);
    console.error('Check your SUPABASE_URL and SUPABASE_SECRET_KEY in .env,');
    console.error('and confirm schema.sql has been run.\n');
    return false;
  }
  return true;
}

(async () => {
  const ok = await verifySupabase();

  app.listen(config.port, () => {
    console.log('');
    console.log('  KV Artchives');
    console.log(`  running on   http://localhost:${config.port}`);
    console.log(`  environment  ${config.env}`);
    console.log(`  supabase     ${ok ? 'connected' : 'NOT CONNECTED'}`);
    console.log('');
  });
})();
