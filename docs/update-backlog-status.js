/**
 * Update Status / Owner / Notes / Updated On on TECH_EARNEST_CRM_SPRINT_BACKLOG_v2.xlsx
 *
 * Usage:
 *   node update-backlog-status.js --done US-S1-001,US-S1-002
 *   node update-backlog-status.js --progress US-S3-001,US-S3-002
 *   node update-backlog-status.js --status "In Progress" --ids US-S3-001
 *   node update-backlog-status.js --next 5   # print next N Not Started in sheet order
 */
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const PRIMARY = path.join(__dirname, "TECH_EARNEST_CRM_SPRINT_BACKLOG.xlsx");
const V2 = path.join(__dirname, "TECH_EARNEST_CRM_SPRINT_BACKLOG_v2.xlsx");

function parseArgs(argv) {
  const out = { ids: [], status: null, next: null, notes: "" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--done") {
      out.status = "Done";
      out.ids = (argv[++i] || "").split(",").map((s) => s.trim()).filter(Boolean);
    } else if (a === "--progress") {
      out.status = "In Progress";
      out.ids = (argv[++i] || "").split(",").map((s) => s.trim()).filter(Boolean);
    } else if (a === "--status") {
      out.status = argv[++i];
    } else if (a === "--ids") {
      out.ids = (argv[++i] || "").split(",").map((s) => s.trim()).filter(Boolean);
    } else if (a === "--next") {
      out.next = Number(argv[++i] || 5);
    } else if (a === "--notes") {
      out.notes = argv[++i] || "";
    } else if (a === "--file") {
      out.file = argv[++i];
    }
  }
  return out;
}

function loadWorkbook(file) {
  if (!fs.existsSync(file)) {
    throw new Error("Missing workbook: " + file);
  }
  return { file, wb: XLSX.readFile(file) };
}

function updateWorkbook(file, ids, status, notes) {
  const { wb } = loadWorkbook(file);
  const sheet = wb.Sheets.UserStories;
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const today = new Date().toISOString().slice(0, 10);
  const idSet = new Set(ids);
  let updated = 0;
  for (const row of rows) {
    if (idSet.has(row["Story ID"])) {
      row.Status = status;
      row["Updated On"] = today;
      if (notes) {
        row.Notes = notes;
      }
      updated += 1;
    }
  }
  const newSheet = XLSX.utils.json_to_sheet(rows);
  // preserve approximate column widths if present
  if (sheet["!cols"]) {
    newSheet["!cols"] = sheet["!cols"];
  }
  wb.Sheets.UserStories = newSheet;
  try {
    XLSX.writeFile(wb, file);
    return { file, updated, locked: false };
  } catch (e) {
    if (e && e.code === "EBUSY") {
      const alt = file.replace(/\.xlsx$/i, ".status-update.xlsx");
      XLSX.writeFile(wb, alt);
      return { file: alt, updated, locked: true, lockedFile: file };
    }
    throw e;
  }
}

function printNext(file, n) {
  const { wb } = loadWorkbook(file);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets.UserStories, { defval: "" });
  const pending = rows.filter((r) => (r.Status || "Not Started") === "Not Started");
  console.log(`Next ${n} Not Started (of ${pending.length} remaining / ${rows.length} total):`);
  pending.slice(0, n).forEach((r, i) => {
    console.log(`${i + 1}. ${r["Story ID"]} [${r.Sprint}] ${r.Title}`);
  });
}

const args = parseArgs(process.argv);
const target = args.file || (fs.existsSync(V2) ? V2 : PRIMARY);

if (args.next) {
  printNext(target, args.next);
  process.exit(0);
}

if (!args.status || !args.ids.length) {
  console.error("Provide --done ID,ID or --progress ID,ID or --status X --ids ID,ID; or --next 5");
  process.exit(1);
}

const result = updateWorkbook(target, args.ids, args.status, args.notes);
console.log(
  `${result.locked ? "Primary locked; wrote " : "Updated "}${result.file} — ${result.updated}/${args.ids.length} stories → ${args.status}`,
);
if (result.locked) {
  console.log(`Close Excel on ${result.lockedFile} and replace with the status-update file.`);
}

// Also try primary if we updated v2
if (target === V2 && fs.existsSync(PRIMARY) && !result.locked) {
  try {
    const r2 = updateWorkbook(PRIMARY, args.ids, args.status, args.notes);
    console.log(`Also updated ${r2.file} (${r2.updated})`);
  } catch (e) {
    console.log(`Primary workbook skip: ${e.message}`);
  }
}
