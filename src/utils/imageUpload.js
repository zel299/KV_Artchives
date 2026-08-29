const crypto = require("crypto");
const sharp = require("sharp");

const config = require("../config");
const { supabaseAdmin } = require("../config/supabase");

async function compress(buffer, maxWidth) {
  return sharp(buffer)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: config.images.quality })
    .toBuffer();
}

async function uploadToBucket(bucket, buffer, folder) {
  const filename = `${crypto.randomUUID()}.webp`;
  const path = folder ? `${folder}/${filename}` : filename;

  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, buffer, { contentType: "image/webp" });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  return path;
}

async function uploadProductImage(buffer) {
  const compressed = await compress(buffer, config.images.productMaxWidth);
  return uploadToBucket(config.buckets.products, compressed, "products");
}

async function uploadReceipt(buffer) {
  const compressed = await compress(buffer, config.images.receiptMaxWidth);
  return uploadToBucket(config.buckets.receipts, compressed, "receipts");
}

function publicUrl(bucket, path) {
  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

function productImageUrl(path) {
  if (!path) return null;
  return publicUrl(config.buckets.products, path);
}

module.exports = {
  compress,
  uploadToBucket,
  uploadProductImage,
  uploadReceipt,
  publicUrl,
  productImageUrl,
};