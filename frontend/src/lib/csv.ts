/**
 * Small CSV export helper for analyst screens.
 *
 * Values are quoted only when they contain a delimiter, quote or newline so the
 * files stay readable, and the download is triggered through a temporary anchor
 * the browser cleans up immediately.
 */

export type CsvValue = string | number | boolean | null | undefined;

const escapeCell = (value: CsvValue): string => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  return [headers, ...rows]
    .map((row) => row.map(escapeCell).join(','))
    .join('\r\n');
}

export function downloadFile(fileName: string, content: string, mimeType = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsv(fileName: string, headers: string[], rows: CsvValue[][]): void {
  downloadFile(fileName, toCsv(headers, rows));
}
