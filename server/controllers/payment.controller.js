// =====================================================================
// PAYMENT CONTROLLER
// =====================================================================

const { v4: uuidv4 } = require('uuid');

const asyncHandler = require('../utils/asyncHandler');
const paymentModel = require('../models/payment.model');
const userModel = require('../models/user.model');
const tournamentModel = require('../models/tournament.model');
const auditLogModel = require('../models/auditLog.model');
const { notifyUser } = require('../services/notification.service');

/** POST /api/payment — submit a payment with a proof-of-payment screenshot (multipart/form-data). */
const submitPayment = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'A proof-of-payment screenshot is required' });
  }

  const actingUser = await userModel.findByUuid(req.user.uuid);
  let tournamentId = null;

  if (req.body.tournamentUuid) {
    const tournament = await tournamentModel.getInternalId(req.body.tournamentUuid);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }
    tournamentId = tournament.id;
  }

  const proofScreenshotUrl = `/uploads/payments/${req.file.filename}`;

  const payment = await paymentModel.createPayment({
    uuid: uuidv4(),
    userId: actingUser.id,
    tournamentId,
    amount: req.body.amount,
    currency: req.body.currency || 'TZS',
    method: req.body.method,
    transactionReference: req.body.transactionReference || null,
    proofScreenshotUrl,
  });

  res.status(201).json({
    success: true,
    message: 'Payment submitted — awaiting admin verification',
    data: { payment },
  });
});

/** GET /api/payment/me — the logged-in user's own payment history. */
const getMyPayments = asyncHandler(async (req, res) => {
  const actingUser = await userModel.findByUuid(req.user.uuid);
  const { page = 1, limit = 20 } = req.query;
  const payments = await paymentModel.listByUser(actingUser.id, { page, limit });
  res.status(200).json({ success: true, data: { payments } });
});

/** GET /api/payment/:uuid — detail view. Owner or admin/moderator only. */
const getPayment = asyncHandler(async (req, res) => {
  const payment = await paymentModel.findByUuid(req.params.uuid);
  if (!payment) {
    return res.status(404).json({ success: false, message: 'Payment not found' });
  }
  const isOwner = payment.user_uuid === req.user.uuid;
  const isStaff = ['admin', 'moderator'].includes(req.user.role);
  if (!isOwner && !isStaff) {
    return res.status(403).json({ success: false, message: 'You do not have permission to view this payment' });
  }
  res.status(200).json({ success: true, data: { payment } });
});

/** GET /api/payment — admin/moderator only, filterable/paginated list of all payments. */
const listPayments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, method } = req.query;
  const payments = await paymentModel.listAll({ page, limit, status, method });
  res.status(200).json({ success: true, data: { payments, page: Number(page), limit: Number(limit) } });
});

/**
 * Shared logic for approve/reject/refund. Loads the payment, checks
 * it's in a valid state for the transition, updates it, writes an
 * audit log entry, and — on approval of a tournament entry-fee
 * payment — auto-approves the payer's pending tournament registration
 * so an admin doesn't have to separately approve both the payment and
 * the entry.
 */
async function transitionPayment(req, res, targetStatus, allowedFromStatuses) {
  const payment = await paymentModel.getInternalId(req.params.uuid);
  if (!payment) {
    res.status(404).json({ success: false, message: 'Payment not found' });
    return;
  }
  if (!allowedFromStatuses.includes(payment.status)) {
    res.status(400).json({
      success: false,
      message: `Cannot mark a '${payment.status}' payment as '${targetStatus}'`,
    });
    return;
  }

  const reviewer = await userModel.findByUuid(req.user.uuid);
  const updated = await paymentModel.updateStatus(payment.id, targetStatus, reviewer.id);

  await auditLogModel.record({
    userId: reviewer.id,
    action: `payment.${targetStatus}`,
    entityType: 'payment',
    entityId: payment.id,
    ipAddress: req.ip,
  });

  // Auto-approve the pending tournament registration this payment was for.
  if (targetStatus === 'approved' && payment.tournament_id) {
    const participant = await tournamentModel.findParticipant(payment.tournament_id, { userId: payment.user_id });
    if (participant && participant.status === 'pending') {
      await tournamentModel.updateParticipantStatusById(participant.id, 'approved');
    }
  }

  const notificationCopy = {
    approved: { title: 'Payment approved', body: 'Your payment has been verified and approved.' },
    rejected: { title: 'Payment rejected', body: 'Your payment could not be verified. Please check the details and resubmit.' },
    refunded: { title: 'Payment refunded', body: 'Your payment has been refunded.' },
  }[targetStatus];
  notifyUser(payment.user_id, { type: `payment_${targetStatus}`, ...notificationCopy, linkUrl: `/payments/${req.params.uuid}` })
    .catch(() => {}); // a notification failure should never fail the admin's approve/reject/refund action

  res.status(200).json({ success: true, message: `Payment ${targetStatus}`, data: { payment: updated } });
}

/** PATCH /api/payment/:uuid/approve — admin/moderator only. */
const approvePayment = asyncHandler(async (req, res) => {
  await transitionPayment(req, res, 'approved', ['pending']);
});

/** PATCH /api/payment/:uuid/reject — admin/moderator only. */
const rejectPayment = asyncHandler(async (req, res) => {
  await transitionPayment(req, res, 'rejected', ['pending']);
});

/** PATCH /api/payment/:uuid/refund — admin only; only a previously approved payment can be refunded. */
const refundPayment = asyncHandler(async (req, res) => {
  await transitionPayment(req, res, 'refunded', ['approved']);
});

module.exports = {
  submitPayment,
  getMyPayments,
  getPayment,
  listPayments,
  approvePayment,
  rejectPayment,
  refundPayment,
};
