#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync, appendFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { renderVideo } from "./render";

// Unconditional trace so we see every invocation regardless of stdout capture
const traceLog = join(tmpdir(), "render-cli-trace.log");
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
  .requiredOption("--output <path>", "output mp4 path")
  .option("--audio <path>", "pre-rendered audio path")
  .parse();

const opts = program.opts();
try {
  appendFileSync(
    traceLog,
    `[${new Date().toISOString()}] parsed opts=${JSON.stringify(opts)}\n`,
  );
} catch {
  // ignore
}

(async () => {
  try {
    const raw = JSON.parse(readFileSync(opts.propsJson, "utf8"));
    const props = { ...raw, format: opts.format };
    const result = await renderVideo({
      props,
      outputPath: opts.output,
      audioPath: opts.audio,
    });
    console.log(JSON.stringify({ ok: true, ...result }));
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: (err as Error).message }));
    process.exit(1);
  }
})();
