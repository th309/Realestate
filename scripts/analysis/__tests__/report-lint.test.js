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

console.log(`${pass} passed, ${fails.length} failed`);
if (fails.length) {
  console.log("FAILURES:\n  " + fails.join("\n  "));
  process.exit(1);
}
