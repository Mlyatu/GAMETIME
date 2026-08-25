// =====================================================================
// REPORT CONTROLLER
// =====================================================================

const asyncHandler = require('../utils/asyncHandler');
const { sendReport } = require('../utils/reportDispatcher');
const tournamentModel = require('../models/tournament.model');
const standingsModel = require('../models/standings.model');
const matchModel = require('../models/match.model');
const paymentModel = require('../models/payment.model');

const STANDINGS_COLUMNS = [
  { header: 'Rank', key: 'rank', width: 1 },
  { header: 'Player', key: 'entrant', width: 3 },
  { header: 'Played', key: 'played', width: 1 },
  { header: 'Won', key: 'won', width: 1 },
  { header: 'Drawn', key: 'drawn', width: 1 },
  { header: 'Lost', key: 'lost', width: 1 },
  { header: 'GF', key: 'goals_for', width: 1 },
  { header: 'GA', key: 'goals_against', width: 1 },
  { header: 'GD', key: 'goal_difference', width: 1 },
  { header: 'Points', key: 'points', width: 1 },
];

const MATCH_COLUMNS = [
  { header: 'Round', key: 'round', width: 2 },
  { header: 'Home', key: 'home', width: 3 },
  { header: 'Away', key: 'away', width: 3 },
  { header: 'Score', key: 'score', width: 1 },
  { header: 'Status', key: 'status', width: 2 },
  { header: 'Scheduled', key: 'scheduled_at', width: 3 },
];

const PAYMENT_COLUMNS = [
  { header: 'User', key: 'username', width: 2 },
  { header: 'Tournament', key: 'tournament_name', width: 3 },
  { header: 'Amount', key: 'amount', width: 1 },
  { header: 'Currency', key: 'currency', width: 1 },
  { header: 'Method', key: 'method', width: 2 },
  { header: 'Status', key: 'status', width: 1 },
  { header: 'Date', key: 'created_at', width: 3 },
];

/** GET /api/report/tournament/:uuid/standings?format=json|csv|excel|pdf */
const standingsReport = asyncHandler(async (req, res) => {
  const tournament = await tournamentModel.getInternalId(req.params.uuid);
  if (!tournament) {
    return res.status(404).json({ success: false, message: 'Tournament not found' });
  }
  const standings = await standingsModel.listByTournament(tournament.id);
  const rows = standings.map((row) => ({
    ...row,
    entrant: row.player_username || row.team_name || '—',
  }));

  return sendReport(req, res, {
    filenameBase: `standings-${req.params.uuid.slice(0, 8)}`,
    title: 'Tournament Standings',
    columns: STANDINGS_COLUMNS,
    rows,
  });
});

/** GET /api/report/tournament/:uuid/matches?format=json|csv|excel|pdf */
const matchHistoryReport = asyncHandler(async (req, res) => {
  const tournament = await tournamentModel.getInternalId(req.params.uuid);
  if (!tournament) {
    return res.status(404).json({ success: false, message: 'Tournament not found' });
  }
  const matches = await matchModel.listByTournament(tournament.id);
  const rows = matches.map((m) => ({
    round: m.round,
    home: m.home_username || m.home_team_name || 'BYE',
    away: m.away_username || m.away_team_name || 'BYE',
    score: m.home_score !== null && m.away_score !== null ? `${m.home_score} - ${m.away_score}` : '—',
    status: m.status,
    scheduled_at: m.scheduled_at ? new Date(m.scheduled_at).toISOString() : '—',
  }));

  return sendReport(req, res, {
    filenameBase: `matches-${req.params.uuid.slice(0, 8)}`,
    title: 'Match History',
    columns: MATCH_COLUMNS,
    rows,
  });
});

/** GET /api/report/payments?format=json|csv|excel|pdf — admin/moderator only. */
const paymentsReport = asyncHandler(async (req, res) => {
  const { status, method } = req.query;
  // Reports need the full set, not one paginated page — a generously
  // high limit on the existing listAll query covers that without a
  // separate unpaginated model function.
  const payments = await paymentModel.listAll({ status, method, page: 1, limit: 100000 });
  const rows = payments.map((p) => ({
    ...p,
    created_at: new Date(p.created_at).toISOString(),
  }));

  return sendReport(req, res, {
    filenameBase: 'payments-report',
    title: 'Payments Report',
    columns: PAYMENT_COLUMNS,
    rows,
  });
});

module.exports = { standingsReport, matchHistoryReport, paymentsReport };
