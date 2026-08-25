// =====================================================================
// EXCEL EXPORT SERVICE (ExcelJS)
// =====================================================================

const ExcelJS = require('exceljs');

/**
 * @param {object} params
 * @param {string} params.title - sheet title / report heading
 * @param {Array<{header: string, key: string, width?: number}>} params.columns
 * @param {Array<object>} params.rows
 * @returns {Promise<Buffer>} .xlsx file contents
 */
async function buildExcelBuffer({ title, columns, rows }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EFootball Arena';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(title.slice(0, 31)); // Excel sheet names cap at 31 chars

  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 20 }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3476F6' } };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  rows.forEach((row) => sheet.addRow(row));

  return workbook.xlsx.writeBuffer();
}

module.exports = { buildExcelBuffer };
