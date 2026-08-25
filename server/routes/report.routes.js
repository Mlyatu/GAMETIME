// =====================================================================
// REPORT ROUTES — /api/report
// =====================================================================

const express = require('express');
const router = express.Router();

const reportController = require('../controllers/report.controller');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/roleCheck');
const { handleValidationErrors } = require('../validators/auth.validator');
const { reportFormatValidator } = require('../validators/report.validator');

// Standings/match history are public data (same as the tournament
// pages themselves) — no auth required to export them.
router.get('/tournament/:uuid/standings', reportFormatValidator, handleValidationErrors, reportController.standingsReport);
router.get('/tournament/:uuid/matches', reportFormatValidator, handleValidationErrors, reportController.matchHistoryReport);

// Payment records are sensitive — admin/moderator only.
router.get(
  '/payments',
  requireAuth,
  requireRole('admin', 'moderator'),
  reportFormatValidator,
  handleValidationErrors,
  reportController.paymentsReport
);

module.exports = router;
