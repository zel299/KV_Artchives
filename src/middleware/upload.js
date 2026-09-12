const multer = require("multer");
const config = require("../config");

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

function fileFilter(req, file, cb) {
    if (!ALLOWED.includes(file.mimetype)) {
        return cb(new Error("Only JPG, PNG, or WebP images are allowed."));
    }
    cb(null, true);
}

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: config.images.maxUploadBytes,
        files: 5,
    },
    fileFilter,
});

const productImages = upload.array("images", 5);
const settingsImage = upload.single("gcash_qr");
const receiptImage = upload.single("receipt");

module.exports = { productImages, settingsImage, receiptImage };