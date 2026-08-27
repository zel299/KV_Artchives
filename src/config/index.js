/**
 * Business rules, kept in one place so they are not scattered
 * as magic numbers across the codebase.
 */

module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  sessionSecret: process.env.SESSION_SECRET,

  // Down payment is a fixed 60% of the subtotal, calculated automatically.
  // Amounts are never rounded: the exact centavo figure makes payments far
  // easier for the admin to match in her GCash or bank transaction list.
  downPaymentPercent: Number(process.env.DOWN_PAYMENT_PERCENT || 60),

  // An order awaiting its down payment expires after this many days.
  // On expiry the stock is returned automatically.
  downPaymentExpiryDays: Number(process.env.DOWN_PAYMENT_EXPIRY_DAYS || 3),

  // Storage buckets, created in the Supabase dashboard.
  buckets: {
    products: 'product-images', // public
    receipts: 'receipts',       // private
    settings: 'settings',       // public
  },

  // Images are compressed before upload. Product photos are permanent and
  // would otherwise dominate the 1 GB free-tier storage quota.
  images: {
    productMaxWidth: 1200,
    receiptMaxWidth: 1000,
    quality: 80,
    maxUploadBytes: 5 * 1024 * 1024, // 5 MB
  },
};
