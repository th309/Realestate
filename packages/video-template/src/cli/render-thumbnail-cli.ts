#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync, appendFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { renderThumbnail } from "./render";
import { FormatKey } from "../types";

const traceLog = join(tmpdir(), "render-thumbnail-cli-trace.log");
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
  .requiredOption("--output <path>", "output png path")
  .option(
    "--frame <n>",
    "frame to render (0..durationInFrames-1); 210 sits inside ScoreReveal for grade_reveal",
    "210",
  )
  .parse();

const opts = program.opts();

(async () => {
  try {
    const raw = JSON.parse(readFileSync(opts.propsJson, "utf8"));
    const props = { ...raw, format: opts.format };
    const result = await renderThumbnail({
      format: opts.format as FormatKey,
      props,
      frame: parseInt(opts.frame, 10),
      outputPath: opts.output,
    });
    console.log(JSON.stringify({ ok: true, ...result }));
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: (err as Error).message }));
    process.exit(1);
  }
})();
