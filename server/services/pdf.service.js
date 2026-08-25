// =====================================================================
// PDF EXPORT SERVICE (PDFKit)
// =====================================================================
// Streams a simple tabular PDF directly to the HTTP response — no
// intermediate buffer needed, PDFKit writes incrementally as rows are
// added, which keeps memory flat even for large reports.
// =====================================================================

const PDFDocument = require('pdfkit');

const BRAND_PRIMARY = '#3476F6';
const PAGE_MARGIN = 40;

/**
 * @param {import('http').ServerResponse} res - the document is piped directly here
 * @param {object} params
 * @param {string} params.title
 * @param {Array<{header: string, key: string, width?: number}>} params.columns
 * @param {Array<object>} params.rows
 */
function streamPdfReport(res, { title, columns, rows }) {
  const doc = new PDFDocument({ margin: PAGE_MARGIN, size: 'A4' });
  doc.pipe(res);

  // --- Header ---
  doc.fillColor(BRAND_PRIMARY).fontSize(20).font('Helvetica-Bold').text('EFootball Arena', PAGE_MARGIN, PAGE_MARGIN);
  doc.fillColor('#111827').fontSize(14).font('Helvetica').text(title, PAGE_MARGIN, PAGE_MARGIN + 26);
  doc.fillColor('#6b7280').fontSize(9).text(`Generated ${new Date().toISOString()}`, PAGE_MARGIN, PAGE_MARGIN + 46);
  doc.moveDown(2);

  const usableWidth = doc.page.width - PAGE_MARGIN * 2;
  const totalWeight = columns.reduce((sum, c) => sum + (c.width || 1), 0);
  const colWidths = columns.map((c) => ((c.width || 1) / totalWeight) * usableWidth);

  let y = doc.y;
  const rowHeight = 20;

  function drawRow(values, { isHeader = false } = {}) {
    let x = PAGE_MARGIN;
    doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(isHeader ? '#ffffff' : '#111827');

    if (isHeader) {
      doc.rect(PAGE_MARGIN, y, usableWidth, rowHeight).fill(BRAND_PRIMARY);
      doc.fillColor('#ffffff');
    }

    values.forEach((val, i) => {
      doc.text(String(val ?? ''), x + 4, y + 5, { width: colWidths[i] - 8, ellipsis: true });
      x += colWidths[i];
    });
    y += rowHeight;
  }

  // Header row
  drawRow(columns.map((c) => c.header), { isHeader: true });

  // Data rows — start a new page if we run out of vertical space
  rows.forEach((row, index) => {
    if (y + rowHeight > doc.page.height - PAGE_MARGIN) {
      doc.addPage();
      y = PAGE_MARGIN;
      drawRow(columns.map((c) => c.header), { isHeader: true });
    }
    // Subtle zebra striping for readability
    if (index % 2 === 1) {
      doc.rect(PAGE_MARGIN, y, usableWidth, rowHeight).fill('#f3f4f6');
    }
    drawRow(columns.map((c) => row[c.key]));
  });

  doc.end();
}

module.exports = { streamPdfReport };
