import { describe, expect, it } from "vitest";
import { readSpreadsheetFile, UnsupportedFileError } from "./spreadsheetFile";

describe("readSpreadsheetFile", () => {
  it("reads CSV files and rejects unsupported extensions", async () => {
    const csv = {
      name: "leads.csv",
      type: "text/csv",
      text: async () => "\uFEFFName,Email\r\nAsha,asha@example.com\r\n",
    } as unknown as File;
    await expect(readSpreadsheetFile(csv)).resolves.toEqual([
      ["Name", "Email"],
      ["Asha", "asha@example.com"],
    ]);

    const xls = new File(["x"], "leads.xls");
    await expect(readSpreadsheetFile(xls)).rejects.toBeInstanceOf(UnsupportedFileError);
  });
});
