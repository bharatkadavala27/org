import * as XLSX from 'xlsx';

// Parse an .xlsx/.csv file -> { headers: string[], rows: any[][] }
// Reads the first sheet, row 0 = headers (per spec, sheet_to_json({header:1})).
export async function parseSpreadsheet(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('No sheet found in the file.');
  const ws = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
  if (!matrix.length) throw new Error('The sheet is empty.');
  const headers = (matrix[0] || []).map((h) => String(h).trim());
  const rows = matrix.slice(1);
  return { headers, rows };
}

// Build CSV text from rows of objects (for error report download).
export function toCsv(headerKeys, rows) {
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headerKeys.join(',')];
  for (const r of rows) lines.push(headerKeys.map((k) => escape(r[k])).join(','));
  return '﻿' + lines.join('\n'); // BOM so Excel reads Gujarati
}

export function downloadText(filename, text, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
