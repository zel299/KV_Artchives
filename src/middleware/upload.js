
const multer = require("multer");
const config = require("../config");

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

function fileFilter(req, file, cb) {
    if (!ALLOWED.includes(file.mimetype)) {
        return cb(new Error("Only JPG, PNG, or WebP images are allowed."));
    }
    cb(null, true);

}

const productImages = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: config.images.maxUploadBytes,
        file: 5,
    },
    fileFilter,
}).array("images", 5);

module.exports = { productImages };