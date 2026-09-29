import { parseCsv } from "@/utils/csvParse";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function cellToString(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) {
    if (Number.isNaN(cell.getTime())) return "";
    return `${cell.getUTCFullYear()}-${pad(cell.getUTCMonth() + 1)}-${pad(cell.getUTCDate())}`;
  }
  if (typeof cell === "boolean") return cell ? "TRUE" : "FALSE";
  return String(cell).trim();
}

export class UnsupportedFileError extends Error {}

/** Reads the first sheet of an .xlsx workbook, or a .csv file, into trimmed string cells. */
export async function readSpreadsheetFile(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    const sheet = await readSheet(file);
    return (sheet as unknown[][])
      .map((row) => row.map(cellToString))
      .filter((row) => row.some((cell) => cell.length > 0));
  }
  if (name.endsWith(".csv") || file.type === "text/csv") {
    const text = await file.text();
    return parseCsv(text.replace(/^\uFEFF/, ""));
  }
  throw new UnsupportedFileError("Only .xlsx and .csv files are supported. Save .xls files as .xlsx first.");
}

export function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
