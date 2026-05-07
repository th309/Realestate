#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync, appendFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { preflight } from "./preflight";

const traceLog = join(tmpdir(), "preflight-cli-trace.log");
try {
  appendFileSync(
    traceLog,
    `[${new Date().toISOString()}] argv=${JSON.stringify(process.argv)}\n`,
  );
} catch {
  // ignore
}

const program = new Command();
program
  .requiredOption("--format <format>", "format key")
  .requiredOption("--props-json <path>", "path to JSON file with props")
  .parse();

const opts = program.opts();

(async () => {
  try {
    const raw = JSON.parse(readFileSync(opts.propsJson, "utf8"));
    const props = { ...raw, format: opts.format };
    const report = await preflight(props);
    console.log(JSON.stringify(report));
    if (!report.ok) process.exit(2);
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: (err as Error).message }));
    process.exit(1);
  }
})();

