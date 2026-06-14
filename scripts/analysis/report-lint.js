// scripts/analysis/report-lint.js
// Deterministic linter for the mechanical PIQ validation-report rules.
// Reads a markdown report, prints {violations:[{rule,line,match,detail}]} to
// stdout. Exit 1 if any violation, else 0. The editorial + structure verifier
// agents run this as their deterministic backbone.
const fs = require("fs");

const file = process.argv[2];
if (!file) {
  process.stderr.write("usage: node report-lint.js <report.md>\n");
  process.exit(2);
}
const text = fs.readFileSync(file, "utf8");
const lines = text.split("\n");
const violations = [];
const add = (rule, lineIdx, match, detail) =>
  violations.push({
    rule,
    line: lineIdx + 1,
    match: String(match).slice(0, 80),
    detail,
  });

// --- EDITORIAL (Rule 5 + Prohibited 3,6,7) ---
const EDITORIAL = [
  {
    re: /\b(strongest|best|most powerful|exceptional|weakest|unmatched|outstanding)\b/i,
    detail: "superlative",
  },
  {
    re: /\b(will outperform|expected to|poised to|going to outperform)\b/i,
    detail: "forward-looking",
  },
  {
    re: /\b(concerning|alarming|impressive|remarkable)\b/i,
    detail: "emotional framing",
  },
  {
    re: /\bROE\b|return on equity|leveraged return|on \$[\d,]+ down/i,
    detail: "ROE/leverage",
  },
];
lines.forEach((l, i) => {
  if (l.trim().startsWith(">")) return; // skip blockquotes/notes
  for (const { re, detail } of EDITORIAL) {
    const m = l.match(re);
    if (m) add("editorial", i, m[0], detail);
  }
});

// --- STRUCTURE (Rule 4 + checklist) ---
// Section numbering: top-level "## N. Title" must be sequential 1..N, no gaps/dupes.
const sectionNums = [];
lines.forEach((l, i) => {
  const m = l.match(/^##\s+(\d+)\.\s/);
  if (m) sectionNums.push({ n: Number(m[1]), line: i });
});
sectionNums.forEach((s, idx) => {
  if (s.n !== idx + 1)
    add(
      "structure",
      s.line,
      `## ${s.n}.`,
      `section numbering: expected ${idx + 1}, got ${s.n}`,
    );
});

// Quintile tables: a header cell containing "Excess Return" must read
// "Excess Return (vs State)" or "Total Excess Return (vs State)".
lines.forEach((l, i) => {
  if (!l.includes("|")) return;
  for (const cell of l.split("|")) {
    if (
      /excess return/i.test(cell) &&
      !/excess return \(vs state\)/i.test(cell)
    ) {
      add(
        "structure",
        i,
        cell.trim(),
        'quintile column must say "Excess Return (vs State)"',
      );
    }
  }
});

// 1Y returns inside the Executive Summary (§1) — headline metric prohibition.
const execStart = lines.findIndex((l) =>
  /^##\s+1\.\s.*executive summary/i.test(l),
);
if (execStart !== -1) {
  let end = lines.findIndex((l, i) => i > execStart && /^##\s+\d+\./.test(l));
  if (end === -1) end = lines.length;
  for (let i = execStart; i < end; i++) {
    const m = lines[i].match(/\b1[\s-]?(?:Y|yr|year)\b/i);
    if (m)
      add(
        "structure",
        i,
        m[0],
        "1Y return in Executive Summary (headline prohibition)",
      );
  }
}

process.stdout.write(JSON.stringify({ violations }, null, 2));
process.exit(violations.length ? 1 : 0);
