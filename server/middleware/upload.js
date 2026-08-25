// =====================================================================
// FILE UPLOAD MIDDLEWARE (Multer)
// =====================================================================
// One configured multer instance per upload "purpose" (payments proof,
// avatars, match screenshots, media library...) so each gets its own
// subfolder under server/uploads/ and can have different size/type
// rules later without touching the others.
// =====================================================================

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const MAX_SIZE_BYTES = (Number(process.env.UPLOAD_MAX_SIZE_MB) || 10) * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_MEDIA_TYPES = [...ALLOWED_IMAGE_TYPES, 'video/mp4', 'video/webm'];
const MEDIA_MAX_SIZE_BYTES = (Number(process.env.MEDIA_MAX_SIZE_MB) || 50) * 1024 * 1024;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function makeUploader(subfolder, allowedTypes, maxSizeBytes) {
  const destination = path.join(__dirname, '..', 'uploads', subfolder);
  ensureDir(destination);

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, destination),
    filename: (req, file, cb) => {
      // Random filename — never trust the client-supplied original
      // name (path traversal, collisions, or leaking local info).
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });

  const fileFilter = (req, file, cb) => {
    if (!allowedTypes.includes(file.mimetype)) {
      const err = new Error(`Unsupported file type. Allowed: ${allowedTypes.join(', ')}`);
      err.statusCode = 400;
      return cb(err);
    }
    return cb(null, true);
  };

  return multer({ storage, fileFilter, limits: { fileSize: maxSizeBytes } });
}

function makeImageUploader(subfolder) {
  return makeUploader(subfolder, ALLOWED_IMAGE_TYPES, MAX_SIZE_BYTES);
}

// One uploader per purpose:
//  - paymentProofUpload: payment screenshots (images only, 10MB default)
//  - resultScreenshotUpload: match result screenshots for OCR (images only, 10MB default)
//  - mediaUpload: tournament posters/banners/logos/gallery/video (images + video, 50MB default)
const paymentProofUpload = makeImageUploader('payments');
const resultScreenshotUpload = makeImageUploader('results');
const avatarUpload = makeImageUploader('avatars');
const mediaUpload = makeUploader('media', ALLOWED_MEDIA_TYPES, MEDIA_MAX_SIZE_BYTES);

module.exports = { paymentProofUpload, resultScreenshotUpload, avatarUpload, mediaUpload };
