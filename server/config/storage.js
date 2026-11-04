const path = require('path');

const serverDirectory = path.resolve(__dirname, '..');

function getUploadDirectory() {
  const configuredDirectory = process.env.UPLOAD_DIR || 'uploads';
  return path.isAbsolute(configuredDirectory)
    ? configuredDirectory
    : path.resolve(serverDirectory, configuredDirectory);
}

module.exports = { getUploadDirectory };
