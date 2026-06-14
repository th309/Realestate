// scripts/analysis/__tests__/report-lint.test.js
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const LINT = path.join(__dirname, "..", "report-lint.js");

function lint(markdown) {
  const tmp = path.join(
    os.tmpdir(),
    `lint-${process.pid}-${Math.floor(performance.now())}.md`,
  );
  fs.writeFileSync(tmp, markdown);
  let out = "";
  try {
    out = execFileSync("node", [LINT, tmp], { encoding: "utf8" });
  } catch (e) {
    out = e.stdout || ""; // exit 1 when violations found
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  return JSON.parse(out);
}

let pass = 0;
const fails = [];
const ok = (label, cond) => (cond ? pass++ : fails.push(label));

// EDITORIAL
ok(
  "flags superlative 'strongest'",
  lint("The strongest market led.").violations.some(
    (v) => v.rule === "editorial",
  ),
);
ok(
  "flags forward-looking 'will outperform'",
  lint("Q5 will outperform Q1.").violations.some((v) => v.rule === "editorial"),
);
ok(
  "flags ROE language",
  lint("Returns on $50,000 down payment.").violations.some(
    (v) => v.rule === "editorial",
  ),
);
ok(
  "clean editorial prose passes",
  lint("Q5 realized a 4.2% excess return vs state.").violations.every(
    (v) => v.rule !== "editorial",
  ),
);

// STRUCTURE
ok(
  "flags non-sequential section numbering",
  lint("## 1. A\n## 3. C").violations.some(
    (v) => v.rule === "structure" && /numbering/.test(v.detail),
  ),
);
ok(
  "flags unlabeled quintile 'Excess Return' header",
  lint("| Quintile | Excess Return |\n|---|---|").violations.some(
    (v) => v.rule === "structure" && /vs State/.test(v.detail),
  ),
);
ok(
  "accepts 'Excess Return (vs State)'",
  lint("| Quintile | Excess Return (vs State) |\n|---|---|").violations.every(
    (v) => v.rule !== "structure",
  ),
);
ok(
  "flags 1Y in executive summary",
  lint(
    "## 1. Executive Summary\nThe 1Y return was 5%.\n## 2. Next",
  ).violations.some((v) => v.rule === "structure" && /1Y/.test(v.detail)),
);
ok(
  "sequential numbering passes",
  lint("## 1. A\n## 2. B\n## 3. C").violations.every(
    (v) => v.rule !== "structure",
  ),
);

// GATE PROOF against the committed fixture
const fixturePath = path.join(
  __dirname,
  "..",
  "__fixtures__",
  "known-bad-report.md",
);
const fixtureFindings = (() => {
  let out = "";
  try {
    out = execFileSync("node", [LINT, fixturePath], { encoding: "utf8" });
  } catch (e) {
    out = e.stdout || "";
  }
  return JSON.parse(out).violations;
})();
ok(
  "fixture: superlative caught",
  fixtureFindings.some((v) => v.detail === "superlative"),
);
ok(
  "fixture: 1Y headline caught",
  fixtureFindings.some((v) => /1Y/.test(v.detail)),
);
ok(
  "fixture: unlabeled quintile caught",
  fixtureFindings.some((v) => /vs State/.test(v.detail)),
);
ok(
  "fixture: numbering gap caught",
  fixtureFindings.some((v) => /numbering/.test(v.detail)),
);

console.log(`${pass} passed, ${fails.length} failed`);
if (fails.length) {
  console.log("FAILURES:\n  " + fails.join("\n  "));
  process.exit(1);
}
