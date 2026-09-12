
const { supabaseAdmin, supabaseAnon } = require("../config/supabase");
const { uploadToBucket, compress, publicUrl } = require("../utils/imageUpload");
const config = require("../config");

async function get() {
  const { data, error } = await supabaseAnon
    .from("settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (error) throw new Error(`settings get failed: ${error.message}`);
  if (!data) return null;

  return {
    gcashQrPath: data.gcash_qr_path,
    gcashQrUrl: data.gcash_qr_path
      ? publicUrl(config.buckets.settings, data.gcash_qr_path)
      : null,
    gcashAccountName: data.gcash_account_name,
    gcashAccountNumber: data.gcash_account_number,
    instagramUrl: data.instagram_url,
    facebookUrl: data.facebook_url,
    downPaymentPercent: Number(data.down_payment_percent),
  };
}

async function update(values, qrBuffer) {
  const patch = {
    gcash_account_name: (values.gcash_account_name || "").trim() || null,
    gcash_account_number: (values.gcash_account_number || "").trim() || null,
    instagram_url: (values.instagram_url || "").trim() || null,
    facebook_url: (values.facebook_url || "").trim() || null,
  };

  if (qrBuffer) {
    const compressed = await compress(qrBuffer, config.images.settingsMaxWidth || 1000);
    patch.gcash_qr_path = await uploadToBucket(
      config.buckets.settings,
      compressed,
      "settings"
    );
  }

  const { error } = await supabaseAdmin
    .from("settings")
    .update(patch)
    .eq("id", true);

  if (error) throw new Error(`settings update failed: ${error.message}`);
}

module.exports = { get, update };