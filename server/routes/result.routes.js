// =====================================================================
// RESULT ROUTES — /api/result
// =====================================================================

const express = require('express');
const router = express.Router();

const resultController = require('../controllers/result.controller');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/roleCheck');
const { resultScreenshotUpload } = require('../middleware/upload');
const { handleValidationErrors } = require('../validators/auth.validator');
const { submitResultValidator } = require('../validators/result.validator');

router.post(
  '/',
  requireAuth,
  resultScreenshotUpload.single('screenshot'),
  submitResultValidator,
  handleValidationErrors,
  resultController.submitResult
);

router.get('/pending', requireAuth, requireRole('admin', 'moderator'), resultController.listPending);
router.get('/match/:matchUuid', requireAuth, resultController.listForMatch);

router.patch('/:uuid/approve', requireAuth, requireRole('admin', 'moderator'), resultController.approveResult);
router.patch('/:uuid/reject', requireAuth, requireRole('admin', 'moderator'), resultController.rejectResult);

module.exports = router;
