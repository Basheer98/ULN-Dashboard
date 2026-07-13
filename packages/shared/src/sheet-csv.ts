/** Convert a 2D sheet grid to CSV text for the project import pipeline. */
export function sheetValuesToCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "");
          if (/[",\n\r]/.test(value)) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(",")
    )
    .join("\n");
}

export function maskSpreadsheetId(id: string): string {
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}
