// =====================================================================
// OCR SERVICE (Tesseract.js)
// =====================================================================
// Extracts text from a submitted match-result screenshot and tries to
// parse a scoreline out of it (e.g. "3 - 1", "3:1", "3—1"). This is a
// convenience for the player/admin, not a source of truth — the
// parsed score is only ever a *suggestion*; a human (the submitting
// player, and then an approving admin/moderator) always confirms the
// final number before it touches `matches`/`standings`.
// =====================================================================

const Tesseract = require('tesseract.js');

// By default, Tesseract.js downloads the English model from a CDN on
// first use and caches it. Environments without that outbound access
// (locked-down servers, some sandboxes) can instead point
// OCR_LANG_PATH at a local directory containing a pre-downloaded
// eng.traineddata file — see server/database/README.md-style note
// below for where to get one.
const tesseractOptions = process.env.OCR_LANG_PATH
  ? { langPath: process.env.OCR_LANG_PATH, gzip: process.env.OCR_LANG_GZIP !== 'false' }
  : {};

// Matches two 1-2 digit numbers separated by a dash, colon, or similar,
// optionally with whitespace — covers the common on-screen scoreboard
// formats ("3-1", "3 - 1", "3:1", "3 – 1").
const SCORELINE_PATTERN = /(\d{1,2})\s*[-:–—]\s*(\d{1,2})/;

/**
 * @param {string} imagePath - absolute path to the uploaded screenshot on disk
 * @returns {Promise<{ rawText: string, confidence: number, parsedHomeScore: number|null, parsedAwayScore: number|null }>}
 */
async function extractScoreFromImage(imagePath) {
  const { data } = await Tesseract.recognize(imagePath, 'eng', tesseractOptions);

  const rawText = data.text || '';
  const confidence = data.confidence || 0; // Tesseract's 0-100 overall confidence for the recognition

  const match = rawText.match(SCORELINE_PATTERN);
  const parsedHomeScore = match ? Number(match[1]) : null;
  const parsedAwayScore = match ? Number(match[2]) : null;

  return { rawText, confidence, parsedHomeScore, parsedAwayScore };
}

module.exports = { extractScoreFromImage };
