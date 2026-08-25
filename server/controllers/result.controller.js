// =====================================================================
// RESULT CONTROLLER
// =====================================================================

const asyncHandler = require('../utils/asyncHandler');
const resultModel = require('../models/result.model');
const matchModel = require('../models/match.model');
const tournamentModel = require('../models/tournament.model');
const userModel = require('../models/user.model');
const standingsService = require('../services/standings.service');
const ocrService = require('../services/ocr.service');
const { notifyUser } = require('../services/notification.service');
const { query } = require('../config/database');

/**
 * POST /api/result — a match participant submits a screenshot as
 * evidence of the final score. Tesseract.js reads the image; the
 * OCR-parsed score is used as a fallback only if the player didn't
 * type one in themselves — either way this is just a *claim*, pending
 * admin/moderator approval before it touches the real match record.
 */
const submitResult = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'A match screenshot is required' });
  }

  const match = await matchModel.getInternalId(req.body.matchUuid);
  if (!match) {
    return res.status(404).json({ success: false, message: 'Match not found' });
  }
  if (match.status === 'completed') {
    return res.status(400).json({ success: false, message: 'This match has already been completed' });
  }

  const screenshotPath = req.file.path;
  const screenshotUrl = `/uploads/results/${req.file.filename}`;

  let ocrResult = { rawText: '', confidence: 0, parsedHomeScore: null, parsedAwayScore: null };
  try {
    ocrResult = await ocrService.extractScoreFromImage(screenshotPath);
  } catch (err) {
    // OCR failing shouldn't block the submission — the player's typed
    // scores (or an admin's manual read of the screenshot later) still work.
    // eslint-disable-next-line no-console
    console.error('OCR extraction failed:', err.message);
  }

  const claimedHomeScore = req.body.claimedHomeScore ?? ocrResult.parsedHomeScore;
  const claimedAwayScore = req.body.claimedAwayScore ?? ocrResult.parsedAwayScore;

  if (claimedHomeScore === null || claimedAwayScore === null || claimedHomeScore === undefined || claimedAwayScore === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Could not determine a score from the screenshot — please enter claimedHomeScore/claimedAwayScore manually',
      data: { ocr: ocrResult },
    });
  }

  const submitter = await userModel.findByUuid(req.user.uuid);
  const savedResult = await resultModel.createResult({
    matchId: match.id,
    submittedBy: submitter.id,
    claimedHomeScore,
    claimedAwayScore,
    screenshotUrl,
    ocrExtractedText: ocrResult.rawText,
    ocrConfidence: ocrResult.confidence,
  });

  res.status(201).json({
    success: true,
    message: 'Result submitted — awaiting verification',
    data: { result: savedResult, ocr: { confidence: ocrResult.confidence } },
  });
});

/** GET /api/result/match/:matchUuid — all submissions for a match (players + staff can view). */
const listForMatch = asyncHandler(async (req, res) => {
  const match = await matchModel.getInternalId(req.params.matchUuid);
  if (!match) {
    return res.status(404).json({ success: false, message: 'Match not found' });
  }
  const results = await resultModel.listByMatch(match.id);
  res.status(200).json({ success: true, data: { results } });
});

/** GET /api/result/pending — admin/moderator queue of everything awaiting review. */
const listPending = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const results = await resultModel.listPending({ page, limit });
  res.status(200).json({ success: true, data: { results } });
});

/**
 * PATCH /api/result/:uuid/approve — admin/moderator only.
 * This is the same completion path Step 6's manual PATCH
 * /api/match/:uuid/score uses: writes the confirmed score onto
 * `matches`, recalculates standings, and notifies both participants.
 */
const approveResult = asyncHandler(async (req, res) => {
  const submission = await resultModel.getInternalId(req.params.uuid);
  if (!submission) {
    return res.status(404).json({ success: false, message: 'Result submission not found' });
  }
  if (submission.verification_status !== 'pending') {
    return res.status(400).json({ success: false, message: `This submission was already ${submission.verification_status}` });
  }

  const reviewer = await userModel.findByUuid(req.user.uuid);
  await resultModel.updateVerification(submission.id, 'approved', reviewer.id);

  const match = await matchModel.setResult(submission.match_id, {
    homeScore: submission.claimed_home_score,
    awayScore: submission.claimed_away_score,
  });

  const [homeParticipant, awayParticipant] = await Promise.all([
    tournamentModel.getParticipantByInternalId(match.home_participant_id),
    tournamentModel.getParticipantByInternalId(match.away_participant_id),
  ]);
  const matchUuidResult = await query('SELECT uuid FROM matches WHERE id = $1', [submission.match_id]);
  const matchUuid = matchUuidResult.rows[0]?.uuid;

  const scoreline = `${submission.claimed_home_score} - ${submission.claimed_away_score}`;
  [homeParticipant, awayParticipant].forEach((participant) => {
    if (participant?.user_id) {
      notifyUser(participant.user_id, {
        type: 'match_completed',
        title: 'Match result approved',
        body: `Final score: ${scoreline}`,
        linkUrl: matchUuid ? `/matches/${matchUuid}` : undefined,
      }).catch(() => {});
    }
  });

  const approvedParticipantsResult = await query(
    'SELECT id FROM tournament_participants WHERE tournament_id = $1 AND status = $2',
    [submission.tournament_id, 'approved']
  );
  const participantIds = approvedParticipantsResult.rows.map((r) => r.id);
  await standingsService.recalculateStandings(submission.tournament_id, participantIds);

  res.status(200).json({ success: true, message: 'Result approved and standings updated' });
});

/** PATCH /api/result/:uuid/reject — admin/moderator only; the player can resubmit. */
const rejectResult = asyncHandler(async (req, res) => {
  const submission = await resultModel.getInternalId(req.params.uuid);
  if (!submission) {
    return res.status(404).json({ success: false, message: 'Result submission not found' });
  }
  if (submission.verification_status !== 'pending') {
    return res.status(400).json({ success: false, message: `This submission was already ${submission.verification_status}` });
  }

  const reviewer = await userModel.findByUuid(req.user.uuid);
  await resultModel.updateVerification(submission.id, 'rejected', reviewer.id);

  notifyUser(submission.submitted_by, {
    type: 'result_rejected',
    title: 'Result submission rejected',
    body: 'Your submitted screenshot could not be verified. Please check the score and resubmit.',
  }).catch(() => {});

  res.status(200).json({ success: true, message: 'Result rejected' });
});

module.exports = { submitResult, listForMatch, listPending, approveResult, rejectResult };
