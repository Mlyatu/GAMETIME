const { body, query: queryValidator } = require('express-validator');

const VALID_METHODS = ['mpesa', 'airtel_money', 'tigo_pesa', 'halopesa', 'bank'];
const VALID_STATUSES = ['pending', 'approved', 'rejected', 'refunded'];

const submitPaymentValidator = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('method').isIn(VALID_METHODS).withMessage(`Method must be one of: ${VALID_METHODS.join(', ')}`),
  body('currency').optional().trim().isLength({ min: 3, max: 10 }).withMessage('Currency code looks invalid'),
  body('tournamentUuid').optional().isUUID().withMessage('tournamentUuid must be a valid UUID'),
  body('transactionReference').optional().trim().isLength({ max: 100 }),
];

const listPaymentsValidator = [
  queryValidator('page').optional().isInt({ min: 1 }).toInt(),
  queryValidator('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  queryValidator('status').optional().isIn(VALID_STATUSES),
  queryValidator('method').optional().isIn(VALID_METHODS),
];

module.exports = { submitPaymentValidator, listPaymentsValidator, VALID_METHODS, VALID_STATUSES };
