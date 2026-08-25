// =====================================================================
// REPORT DISPATCHER
// =====================================================================
// One function every report endpoint calls once it has its rows —
// keeps the "which format, which headers, which content-type" logic
// in exactly one place instead of repeated per report type.
// =====================================================================

const { toCsv } = require('../utils/csv');
const { buildExcelBuffer } = require('../services/excel.service');
const { streamPdfReport } = require('../services/pdf.service');

const VALID_FORMATS = ['json', 'csv', 'excel', 'pdf'];

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {object} params
 * @param {string} params.filenameBase - e.g. 'standings-my-cup' (no extension)
 * @param {string} params.title - human-readable report title (shown in PDF, used as Excel sheet name)
 * @param {Array<{header: string, key: string, width?: number}>} params.columns
 * @param {Array<object>} params.rows
 */
async function sendReport(req, res, { filenameBase, title, columns, rows }) {
  const format = (req.query.format || 'json').toLowerCase();
  if (!VALID_FORMATS.includes(format)) {
    return res.status(400).json({ success: false, message: `format must be one of: ${VALID_FORMATS.join(', ')}` });
  }

  if (format === 'json') {
    return res.status(200).json({ success: true, data: { rows } });
  }

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
    return res.status(200).send(toCsv(columns, rows));
  }

  if (format === 'excel') {
    const buffer = await buildExcelBuffer({ title, columns, rows });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`);
    return res.status(200).send(buffer);
  }

  // format === 'pdf'
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.pdf"`);
  streamPdfReport(res, { title, columns, rows });
  return undefined; // response is ended by streamPdfReport's doc.end()
}

module.exports = { sendReport };
