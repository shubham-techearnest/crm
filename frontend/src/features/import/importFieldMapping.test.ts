import { describe, expect, it } from "vitest";
import { IGNORE_COLUMN, type ImportFieldSpec, type ImportSchema } from "./bulkImportApi";
import { bestTemplate, matchColumns, scoreHeader } from "./fieldMatching";
import { buildImportPlan, classifyRows, mappingBlockers, summarizeMapping, type MappingDecisions } from "./importPlan";
import { convertValue } from "./valueTransforms";

function field(key: string, label: string, type: ImportFieldSpec["type"] = "TEXT", extra: Partial<ImportFieldSpec> = {}): ImportFieldSpec {
  return {
    key,
    label,
    type,
    required: false,
    options: [],
    maxLength: null,
    aliases: [],
    reference: null,
    metadataCode: null,
    groupHeader: false,
    defaultValue: null,
    ...extra,
  };
}

const FIELDS: ImportFieldSpec[] = [
  field("firstName", "First name", "TEXT", { required: true }),
  field("email", "Email", "EMAIL", { aliases: ["e-mail address"] }),
  field("phone", "Phone", "PHONE"),
  field("companyName", "Company", "TEXT"),
  field("status", "Status", "ENUM", { options: ["NEW", "ACTIVE", "LOST"] }),
  field("emailOptOut", "Email opt out", "BOOLEAN"),
  field("expectedCloseDate", "Expected close date", "DATE"),
  field("noOfEmployees", "Employees", "INTEGER"),
];

function schema(overrides: Partial<ImportSchema> = {}): ImportSchema {
  return {
    module: "leads",
    metadataTable: "lead",
    usesRegion: false,
    groupKey: null,
    duplicateRule: null,
    maxRows: 1000,
    customFieldsSupported: false,
    fields: FIELDS,
    ...overrides,
  };
}

function decisions(headers: string[], target: ImportSchema = schema()): MappingDecisions {
  return {
    mappings: matchColumns(headers, target.fields),
    transforms: {},
    defaults: {},
    valueMaps: {},
    defaultRegionId: "",
  };
}

describe("field matching", () => {
  it("rates exact, alias, filler-word, similar and unrelated headers", () => {
    expect(scoreHeader("FIRST_NAME", FIELDS[0]).confidence).toBe("exact");
    expect(scoreHeader("firstName", FIELDS[0]).confidence).toBe("exact");
    expect(scoreHeader("E-mail Address", FIELDS[1]).confidence).toBe("high");
    expect(scoreHeader("Phone Number", FIELDS[2]).confidence).toBe("high");
    expect(scoreHeader("Company Name", FIELDS[3]).confidence).toBe("exact");
    expect(scoreHeader("Company No", FIELDS[3]).confidence).toBe("high");
    expect(scoreHeader("Favourite colour", FIELDS[0]).confidence).toBe("none");
  });

  it("maps confident matches, asks to confirm medium ones and never applies low ones", () => {
    const mappings = matchColumns(["First Name", "Phone Number", "Expected close", "Statuss", "Notes"], FIELDS);
    expect(mappings[0]).toMatchObject({ target: "firstName", status: "matched", confidence: "exact" });
    expect(mappings[1]).toMatchObject({ target: "phone", status: "matched", confidence: "high" });
    expect(mappings[2]).toMatchObject({ target: "expectedCloseDate", status: "suggested", confidence: "medium" });
    expect(mappings[3].status).not.toBe("matched");
    expect(mappings[4]).toMatchObject({ target: null, status: "unmatched", autoUnmatched: true });
    mappings
      .filter((mapping) => mapping.confidence === "low")
      .forEach((mapping) => expect(mapping.target).toBeNull());
  });

  it("uses each target field for one column only", () => {
    const mappings = matchColumns(["Email", "EMAIL"], FIELDS);
    expect(mappings.filter((mapping) => mapping.target === "email")).toHaveLength(1);
  });

  it("applies a saved template, including ignored columns, and picks it by header coverage", () => {
    const template = {
      name: "Trade show",
      columns: { contactperson: "firstName", internalid: IGNORE_COLUMN },
      transforms: {},
      defaults: {},
      valueMaps: {},
      savedAt: "2026-09-29T00:00:00Z",
    };
    expect(bestTemplate(["Contact Person", "Internal ID", "Email"], [template])).toBe(template);
    expect(bestTemplate(["Something", "Else"], [template])).toBeNull();

    const mappings = matchColumns(["Contact Person", "Internal ID", "Email"], FIELDS, template);
    expect(mappings[0]).toMatchObject({ target: "firstName", status: "matched", source: "template" });
    expect(mappings[1]).toMatchObject({ status: "ignored", source: "template" });
    expect(mappings[2]).toMatchObject({ target: "email", source: "auto" });
  });
});

describe("value conversion", () => {
  const byKey = Object.fromEntries(FIELDS.map((spec) => [spec.key, spec]));

  it("converts phones, booleans, picklists and day-first dates", () => {
    expect(convertValue("+91 98765-43210", byKey.phone, "national10")).toMatchObject({ value: "9876543210", status: "converted" });
    expect(convertValue("+91 98765 43210", byKey.phone, "digits").value).toBe("+919876543210");
    expect(convertValue("Yes", byKey.emailOptOut, "auto")).toMatchObject({ value: "true", status: "converted" });
    expect(convertValue("n", byKey.emailOptOut, "auto").value).toBe("false");
    expect(convertValue("Active", byKey.status, "auto")).toMatchObject({ value: "ACTIVE", status: "converted" });
    expect(convertValue("29/09/2026", byKey.expectedCloseDate, "auto")).toMatchObject({ value: "2026-09-29", status: "converted" });
    expect(convertValue("2026-09-29", byKey.expectedCloseDate, "auto")).toMatchObject({ status: "valid" });
  });

  it("flags ambiguous dates, honours the chosen format and rejects impossible ones", () => {
    expect(convertValue("03/04/2026", byKey.expectedCloseDate, "auto")).toMatchObject({ value: "2026-04-03", status: "warning" });
    expect(convertValue("03/04/2026", byKey.expectedCloseDate, "mdy")).toMatchObject({ value: "2026-03-04", status: "converted" });
    expect(convertValue("31/02/2026", byKey.expectedCloseDate, "auto").status).toBe("error");
  });

  it("uses value maps for picklists and reports unknown values", () => {
    expect(convertValue("Won", byKey.status, "auto").status).toBe("error");
    expect(convertValue("Won", byKey.status, "auto", { won: "ACTIVE" }).value).toBe("ACTIVE");
  });

  it("only rounds whole numbers when asked to, and enforces max length", () => {
    expect(convertValue("2.5", byKey.noOfEmployees, "strict").status).toBe("error");
    expect(convertValue("2.6", byKey.noOfEmployees, "round")).toMatchObject({ value: "3", status: "warning" });
    expect(convertValue("abcdef", field("code", "Code", "TEXT", { maxLength: 3 }), "trim").status).toBe("error");
  });
});

describe("import plan", () => {
  it("blocks until suggestions are confirmed, columns decided and required fields resolved", () => {
    const target = schema({ usesRegion: true, fields: [...FIELDS, field("region", "Region", "REFERENCE")] });
    const plan = decisions(["Expected close", "Notes"], target);
    const blockers = mappingBlockers(target, plan);
    expect(blockers.join(" ")).toContain("Confirm or change 1 suggested mapping");
    expect(blockers.join(" ")).toContain("Notes");
    expect(blockers.join(" ")).toContain("First name is required");
    expect(blockers.join(" ")).toContain("Region is required");

    plan.mappings[0].status = "matched";
    plan.mappings[1].status = "ignored";
    plan.defaults.firstName = "Unknown";
    plan.defaultRegionId = "region-1";
    expect(mappingBlockers(target, plan)).toEqual([]);
  });

  it("applies defaults and conversions and reports row errors with spreadsheet row numbers", () => {
    const target = schema();
    const plan = decisions(["First Name", "Email", "Status"], target);
    plan.defaults.status = "New";
    const rows = buildImportPlan(
      [
        ["Asha", "ASHA@example.com", ""],
        ["", "", ""],
        ["", "ravi@example", "Lost"],
      ],
      target,
      plan,
    );
    expect(rows.map((row) => row.sourceRow)).toEqual([2, 4]);
    expect(rows[0].values).toEqual({ firstName: "Asha", email: "asha@example.com", status: "NEW" });
    expect(rows[0].cells.find((cell) => cell.field === "status")?.fromDefault).toBe(true);
    expect(rows[1].errors).toEqual(expect.arrayContaining(["First name is required"]));
    expect(rows[1].errors.some((error) => error.startsWith("Email:"))).toBe(true);
  });

  it("checks header fields once per multi-row record and fails the whole record together", () => {
    const target = schema({
      groupKey: "reference",
      fields: [
        field("reference", "Reference"),
        field("accountName", "Account", "REFERENCE", { required: true, groupHeader: true }),
        field("quantity", "Quantity", "INTEGER"),
      ],
    });
    const plan = decisions(["Reference", "Account", "Quantity"], target);
    const rows = buildImportPlan(
      [
        ["INV-1", "Acme", "1"],
        ["INV-1", "", "2"],
        ["INV-2", "Globex", "x"],
        ["INV-2", "", "3"],
      ],
      target,
      plan,
    );
    expect(rows[0].errors).toEqual([]);
    expect(rows[1].errors).toEqual([]);
    expect(rows[2].errors[0]).toContain("Quantity");
    expect(rows[3].errors[0]).toContain("Row 4 of the same record");
  });

  it("combines client checks with the server dry run and summarises the mapping", () => {
    const target = schema();
    const plan = decisions(["First Name", "Email", "Expected close date", "Internal ID"], target);
    plan.mappings[3].status = "ignored";
    const rows = buildImportPlan(
      [
        ["Asha", "asha@example.com", "2026-09-29"],
        ["Ravi", "ravi@example.com", "03/04/2026"],
        ["Meera", "meera@example.com", ""],
        ["", "kiran@example.com", ""],
      ],
      target,
      plan,
    );
    const sent = rows.filter((row) => !row.errors.length);
    const reviewed = classifyRows(rows, sent, {
      module: "leads",
      total: 3,
      imported: 1,
      skipped: 1,
      failed: 0,
      dryRun: true,
      issues: [{ index: 2, outcome: "SKIPPED", reason: "A lead with this email already exists" }],
    });
    expect(reviewed.map((row) => row.outcome)).toEqual(["valid", "warning", "duplicate", "invalid"]);
    expect(summarizeMapping(target, plan)).toEqual({ mapped: 3, unmatched: 1, ignored: 1, created: 0, conversions: 1 });
  });
});
