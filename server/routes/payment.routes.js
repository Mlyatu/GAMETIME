// =====================================================================
// PAYMENT ROUTES — /api/payment
// =====================================================================

const express = require('express');
const router = express.Router();

const paymentController = require('../controllers/payment.controller');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/roleCheck');
const { paymentProofUpload } = require('../middleware/upload');
const { handleValidationErrors } = require('../validators/auth.validator');
const { submitPaymentValidator, listPaymentsValidator } = require('../validators/payment.validator');

// Player submits a payment with a proof screenshot — multipart/form-data,
// field name 'proof' for the file plus amount/method/etc as text fields.
router.post(
  '/',
  requireAuth,
  paymentProofUpload.single('proof'),
  submitPaymentValidator,
  handleValidationErrors,
  paymentController.submitPayment
);

router.get('/me', requireAuth, paymentController.getMyPayments);

router.get('/', requireAuth, requireRole('admin', 'moderator'), listPaymentsValidator, handleValidationErrors, paymentController.listPayments);
router.get('/:uuid', requireAuth, paymentController.getPayment);

router.patch('/:uuid/approve', requireAuth, requireRole('admin', 'moderator'), paymentController.approvePayment);
router.patch('/:uuid/reject', requireAuth, requireRole('admin', 'moderator'), paymentController.rejectPayment);
router.patch('/:uuid/refund', requireAuth, requireRole('admin'), paymentController.refundPayment);

module.exports = router;
