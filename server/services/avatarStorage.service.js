const cloudinary = require('cloudinary').v2;

function uploadAvatar(buffer, userUuid) {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    const error = new Error('Avatar image storage is not configured. Contact the administrator.');
    error.statusCode = 503;
    error.code = 'AVATAR_STORAGE_NOT_CONFIGURED';
    throw error;
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });

  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        folder: 'gametime/avatars',
        public_id: userUuid,
        overwrite: true,
        resource_type: 'image',
        transformation: [{ width: 500, height: 500, crop: 'fill' }],
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result || !result.secure_url) {
          return reject(new Error('Cloudinary did not return a secure avatar URL'));
        }
        return resolve(result.secure_url);
      }
    );
    upload.end(buffer);
  });
}

module.exports = { uploadAvatar };
