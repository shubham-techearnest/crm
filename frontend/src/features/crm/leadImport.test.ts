import { describe, expect, it } from "vitest";
import {
  guessMapping,
  leadImportTemplateCsv,
  normalizeDate,
  normalizeNumber,
  prepareLeadRows,
  readSpreadsheetFile,
  UnsupportedFileError,
} from "./leadImport";
import { parseCsv } from "@/utils/csvParse";

describe("leadImport helpers", () => {
  it("guesses mappings from common header spellings", () => {
    expect(guessMapping("First Name")).toBe("firstName");
    expect(guessMapping("Email Address")).toBe("email");
    expect(guessMapping("Company_Name")).toBe("companyName");
    expect(guessMapping("Pin Code")).toBe("addressZip");
    expect(guessMapping("Something else")).toBe("");
  });

  it("template headers all map to a lead field", () => {
    const [headers] = parseCsv(leadImportTemplateCsv());
    expect(headers.every((header) => guessMapping(header))).toBe(true);
  });

  it("normalizes ISO and day-first dates and rejects invalid ones", () => {
    expect(normalizeDate("2026-1-5")).toBe("2026-01-05");
    expect(normalizeDate("31/12/2026")).toBe("2026-12-31");
    expect(normalizeDate("31-02-2026")).toBeNull();
    expect(normalizeDate("next week")).toBeNull();
  });

  it("normalizes numbers with separators and currency symbols", () => {
    expect(normalizeNumber("₹2,50,000")).toBe(250000);
    expect(normalizeNumber("12.5")).toBe(12.5);
    expect(normalizeNumber("abc")).toBeNull();
  });

  it("prepares rows, keeping spreadsheet row numbers and reporting bad cells", () => {
    const mappings = ["firstName", "email", "estimatedValue", "expectedCloseDate", "status", ""];
    const data = [
      ["Asha", "asha@example.com", "1,000", "2026-12-31", "qualified", "ignored"],
      ["", "", "", "", "", ""],
      ["Ravi", "ravi@example.com", "lots", "", "", ""],
      ["Meera", "meera@example.com", "", "32/01/2026", "", ""],
      ["Kiran", "kiran@example.com", "", "", "", ""],
    ];
    const { rows, problems } = prepareLeadRows(data, mappings, "region-1");

    expect(rows.map((row) => row.sourceRow)).toEqual([2, 6]);
    expect(rows[0].body).toEqual({
      regionId: "region-1",
      firstName: "Asha",
      email: "asha@example.com",
      estimatedValue: 1000,
      expectedCloseDate: "2026-12-31",
      status: "QUALIFIED",
    });
    expect(problems.map((problem) => problem.sourceRow)).toEqual([4, 5]);
    expect(problems[0].reason).toContain("not a valid number");
    expect(problems[1].reason).toContain("not a valid date");
  });

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
