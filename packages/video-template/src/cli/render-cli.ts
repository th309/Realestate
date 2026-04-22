#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync } from "fs";
import { renderVideo } from "./render";

const program = new Command();
program
  .requiredOption("--format <format>", "format key")
  .requiredOption("--props-json <path>", "path to JSON file with props")
  .requiredOption("--output <path>", "output mp4 path")
  .option("--audio <path>", "pre-rendered audio path")
  .parse();

const opts = program.opts();

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
