import { IGNORE_COLUMN, type ImportFieldSpec, type ImportMappingTemplate } from "./bulkImportApi";

export type MatchConfidence = "exact" | "high" | "medium" | "low" | "none";
export type MappingStatus = "matched" | "suggested" | "unmatched" | "ignored";
export type MappingSource = "auto" | "template" | "manual";

export interface ColumnMapping {
  column: number;
  header: string;
  /** Target field key; null when unmapped or ignored. */
  target: string | null;
  status: MappingStatus;
  confidence: MatchConfidence;
  source: MappingSource;
  /** Low-confidence guess shown to the user but never applied automatically. */
  suggestion: string | null;
  /** True when the column had no automatic match at all (reported as "unmatched" in the summary). */
  autoUnmatched: boolean;
}

export const CONFIDENCE_LABEL: Record<MatchConfidence, string> = {
  exact: "Exact",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "None",
};

/** Words that do not change which field a header means ("Phone Number" → phone, "Company Name" → company). */
const FILLER_WORDS = new Set(["name", "number", "no", "num", "nr", "of", "the", "field", "value", "details", "info"]);

export function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function tokens(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function withoutFiller(value: string): string {
  const kept = tokens(value).filter((token) => !FILLER_WORDS.has(token));
  return kept.join("");
}

function bigrams(value: string): string[] {
  const grams: string[] = [];
  for (let i = 0; i < value.length - 1; i += 1) grams.push(value.slice(i, i + 2));
  return grams;
}

/** Sørensen–Dice similarity over character bigrams of the normalised strings (0..1). */
export function similarity(a: string, b: string): number {
  const x = normalizeHeader(a);
  const y = normalizeHeader(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;
  const left = bigrams(x);
  const right = bigrams(y);
  const counts = new Map<string, number>();
  left.forEach((gram) => counts.set(gram, (counts.get(gram) ?? 0) + 1));
  let overlap = 0;
  right.forEach((gram) => {
    const count = counts.get(gram) ?? 0;
    if (count > 0) {
      overlap += 1;
      counts.set(gram, count - 1);
    }
  });
  return (2 * overlap) / (left.length + right.length);
}

interface Score {
  confidence: MatchConfidence;
  score: number;
}

const CONFIDENCE_SCORE: Record<MatchConfidence, number> = { exact: 4, high: 3, medium: 2, low: 1, none: 0 };

/** How confidently an imported header corresponds to a target field. */
export function scoreHeader(header: string, field: ImportFieldSpec): Score {
  const normalized = normalizeHeader(header);
  if (!normalized) return { confidence: "none", score: 0 };
  const primary = [field.label, field.key];
  const aliases = field.aliases ?? [];

  if (primary.some((name) => normalizeHeader(name) === normalized)) {
    return { confidence: "exact", score: 1 };
  }
  if (aliases.some((alias) => normalizeHeader(alias) === normalized)) {
    return { confidence: "high", score: 0.95 };
  }
  const stripped = withoutFiller(header);
  const candidates = [...primary, ...aliases];
  if (stripped && candidates.some((name) => withoutFiller(name) === stripped || normalizeHeader(name) === stripped)) {
    return { confidence: "high", score: 0.9 };
  }

  let best = 0;
  candidates.forEach((name) => {
    const target = normalizeHeader(name);
    if (target.length >= 4 && normalized.length >= 4 && (normalized.includes(target) || target.includes(normalized))) {
      best = Math.max(best, 0.72);
    }
    best = Math.max(best, similarity(header, name), stripped ? similarity(stripped, name) : 0);
  });
  if (best >= 0.7) return { confidence: "medium", score: best };
  if (best >= 0.5) return { confidence: "low", score: best };
  return { confidence: "none", score: best };
}

function unmapped(column: number, header: string): ColumnMapping {
  return {
    column,
    header,
    target: null,
    status: "unmatched",
    confidence: "none",
    source: "auto",
    suggestion: null,
    autoUnmatched: true,
  };
}

/**
 * Matches file columns to target fields. Each field is used by at most one column; the strongest pairs win.
 * Exact/high matches are mapped, medium ones are pre-selected but need confirmation, low ones are only
 * suggested. A saved template takes precedence for the headers it knows.
 */
export function matchColumns(
  headers: string[],
  fields: ImportFieldSpec[],
  template?: ImportMappingTemplate | null,
): ColumnMapping[] {
  const mappings = headers.map((header, column) => unmapped(column, header));
  const usedFields = new Set<string>();
  const fieldKeys = new Set(fields.map((field) => field.key));

  if (template) {
    mappings.forEach((mapping) => {
      const saved = template.columns[normalizeHeader(mapping.header)];
      if (!saved) return;
      if (saved === IGNORE_COLUMN) {
        Object.assign(mapping, { status: "ignored", source: "template", autoUnmatched: false });
        return;
      }
      if (fieldKeys.has(saved) && !usedFields.has(saved)) {
        usedFields.add(saved);
        Object.assign(mapping, {
          target: saved,
          status: "matched",
          confidence: "exact",
          source: "template",
          autoUnmatched: false,
        });
      }
    });
  }

  const pairs: { column: number; field: string; confidence: MatchConfidence; score: number }[] = [];
  mappings.forEach((mapping) => {
    if (mapping.source === "template") return;
    fields.forEach((field) => {
      const { confidence, score } = scoreHeader(mapping.header, field);
      if (confidence !== "none") pairs.push({ column: mapping.column, field: field.key, confidence, score });
    });
  });
  pairs.sort(
    (a, b) => CONFIDENCE_SCORE[b.confidence] - CONFIDENCE_SCORE[a.confidence] || b.score - a.score,
  );

  const decided = new Set<number>();
  pairs.forEach((pair) => {
    if (decided.has(pair.column)) return;
    const mapping = mappings[pair.column];
    if (pair.confidence === "low") {
      if (!mapping.suggestion && !usedFields.has(pair.field)) {
        mapping.suggestion = pair.field;
        mapping.confidence = "low";
      }
      return;
    }
    if (usedFields.has(pair.field)) return;
    usedFields.add(pair.field);
    decided.add(pair.column);
    Object.assign(mapping, {
      target: pair.field,
      status: pair.confidence === "medium" ? "suggested" : "matched",
      confidence: pair.confidence,
      suggestion: null,
      autoUnmatched: false,
    });
  });

  mappings.forEach((mapping) => {
    if (mapping.status === "unmatched" && mapping.suggestion && usedFields.has(mapping.suggestion)) {
      mapping.suggestion = null;
      mapping.confidence = "none";
    }
  });
  return mappings;
}

/** Picks the saved template whose headers best cover this file (at least half of the template's columns). */
export function bestTemplate(
  headers: string[],
  templates: ImportMappingTemplate[],
): ImportMappingTemplate | null {
  const present = new Set(headers.map(normalizeHeader));
  let best: { template: ImportMappingTemplate; coverage: number } | null = null;
  templates.forEach((template) => {
    const known = Object.keys(template.columns);
    if (!known.length) return;
    const coverage = known.filter((header) => present.has(header)).length / known.length;
    if (coverage >= 0.5 && (!best || coverage > best.coverage)) best = { template, coverage };
  });
  return (best as { template: ImportMappingTemplate } | null)?.template ?? null;
}
