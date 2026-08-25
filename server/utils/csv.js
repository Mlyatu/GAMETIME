// =====================================================================
// CSV EXPORT UTILITY
// =====================================================================
// No external dependency — CSV is simple enough that pulling in a
// library for it would be more overhead than it saves. Handles the
// three characters that require quoting per RFC 4180: comma, double
// quote, and newline.
// =====================================================================

function escapeCsvField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * @param {Array<{header: string, key: string}>} columns
 * @param {Array<object>} rows
 * @returns {string} CSV text, including a header row
 */
function toCsv(columns, rows) {
  const headerLine = columns.map((c) => escapeCsvField(c.header)).join(',');
  const dataLines = rows.map((row) =>
    columns.map((c) => escapeCsvField(row[c.key])).join(',')
  );
  return [headerLine, ...dataLines].join('\r\n');
}

module.exports = { toCsv };
