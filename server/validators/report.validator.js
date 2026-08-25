const { query } = require('express-validator');

const reportFormatValidator = [
  query('format').optional().isIn(['json', 'csv', 'excel', 'pdf']).withMessage('format must be one of: json, csv, excel, pdf'),
];

module.exports = { reportFormatValidator };
