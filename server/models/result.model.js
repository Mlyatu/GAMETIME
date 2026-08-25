// =====================================================================
// RESULT MODEL
// =====================================================================
// A `results` row is a player's claimed scoreline plus the evidence
// (screenshot + OCR output) behind it. Approving one is what actually
// writes the confirmed score onto `matches` (see result.controller.js)
// — this table is the audit trail of every submission/resubmission,
// separate from the single confirmed score matches ends up with.
// =====================================================================

const { query } = require('../config/database');

async function createResult({
  matchId, submittedBy, claimedHomeScore, claimedAwayScore, screenshotUrl, ocrExtractedText, ocrConfidence,
}) {
  const result = await query(
    `INSERT INTO results
       (match_id, submitted_by, claimed_home_score, claimed_away_score, screenshot_url, ocr_extracted_text, ocr_confidence, verification_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
     RETURNING uuid, claimed_home_score, claimed_away_score, screenshot_url, ocr_confidence, verification_status, created_at`,
    [matchId, submittedBy, claimedHomeScore, claimedAwayScore, screenshotUrl, ocrExtractedText, ocrConfidence]
  );
  return result.rows[0];
}

async function findByUuid(uuid) {
  const result = await query(
    `SELECT r.uuid, r.claimed_home_score, r.claimed_away_score, r.screenshot_url,
            r.ocr_extracted_text, r.ocr_confidence, r.verification_status, r.created_at, r.verified_at,
            m.uuid AS match_uuid, m.tournament_id,
            u.uuid AS submitted_by_uuid, u.username AS submitted_by_username,
            rv.username AS verified_by_username
     FROM results r
     JOIN matches m ON m.id = r.match_id
     JOIN users u ON u.id = r.submitted_by
     LEFT JOIN users rv ON rv.id = r.verified_by
     WHERE r.uuid = $1`,
    [uuid]
  );
  return result.rows[0] || null;
}

/** Internal id + match/tournament context — needed to drive the approval side-effects (score write, standings recalc). */
async function getInternalId(uuid) {
  const result = await query(
    `SELECT r.id, r.match_id, r.claimed_home_score, r.claimed_away_score, r.verification_status, r.submitted_by,
            m.tournament_id
     FROM results r
     JOIN matches m ON m.id = r.match_id
     WHERE r.uuid = $1`,
    [uuid]
  );
  return result.rows[0] || null;
}

async function listByMatch(matchId) {
  const result = await query(
    `SELECT r.uuid, r.claimed_home_score, r.claimed_away_score, r.screenshot_url,
            r.ocr_confidence, r.verification_status, r.created_at,
            u.username AS submitted_by_username
     FROM results r
     JOIN users u ON u.id = r.submitted_by
     WHERE r.match_id = $1
     ORDER BY r.created_at DESC`,
    [matchId]
  );
  return result.rows;
}

async function listPending({ page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const result = await query(
    `SELECT r.uuid, r.claimed_home_score, r.claimed_away_score, r.screenshot_url,
            r.ocr_confidence, r.created_at,
            m.uuid AS match_uuid, m.round,
            u.username AS submitted_by_username
     FROM results r
     JOIN matches m ON m.id = r.match_id
     JOIN users u ON u.id = r.submitted_by
     WHERE r.verification_status = 'pending'
     ORDER BY r.created_at ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
}

async function updateVerification(resultId, status, reviewerUserId) {
  const result = await query(
    `UPDATE results SET verification_status = $2, verified_by = $3, verified_at = NOW()
     WHERE id = $1
     RETURNING uuid, verification_status`,
    [resultId, status, reviewerUserId]
  );
  return result.rows[0] || null;
}

module.exports = { createResult, findByUuid, getInternalId, listByMatch, listPending, updateVerification };
