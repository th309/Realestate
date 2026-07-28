/**
 * Generates the video mix's audio assets into public/audio/ as 16-bit WAVs:
 *   music-bed.wav   32s seamless ambient pad loop (ducked under narration)
 *   room-tone.wav   12s seamless low ambience loop
 *   sfx-whoosh.wav  entrance whoosh
 *   sfx-tick.wav    counter/list tick
 *   sfx-chime.wav   score-settle chime
 *
 * Fully deterministic (seeded PRNG) — rerunning reproduces identical files.
 * To use licensed audio instead, replace the files keeping the same names
 * (paths are referenced from src/audio/levels.ts AUDIO_ASSETS).
 *
 * Run: node scripts/generate-audio-assets.mjs
 */
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const SR = 44100;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "audio");

// ── Deterministic PRNG (mulberry32) ─────────────────────────────────────────
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── WAV encoding ────────────────────────────────────────────────────────────
function writeWav(path, samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  writeFileSync(path, buf);
  console.log(`wrote ${path} (${(buf.length / 1024).toFixed(0)} KB)`);
}

function normalize(samples, peak) {
  let max = 1e-9;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  const g = peak / max;
  for (let i = 0; i < samples.length; i++) samples[i] *= g;
  return samples;
}

const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

// ── Music bed: 32s ambient indigo pad, 8×4s chords, wrap-aware crossfade ───
function musicBed() {
  const SEG = 4 * SR;
  const XF = Math.floor(1.2 * SR);
  const total = 8 * SEG;
  const out = new Float64Array(total);
  // Am9 · Fmaj9 · Cmaj9 · Gadd9, twice (MIDI). Low-mid voicing, soft top.
  const chords = [
    [45, 52, 55, 59, 64],
    [41, 48, 53, 57, 64],
    [48, 52, 55, 59, 62],
    [43, 50, 55, 57, 62],
  ];
  const detunes = [-1.5, 1.5]; // cents
  for (let seg = 0; seg < 8; seg++) {
    const notes = chords[seg % 4];
    const segStart = seg * SEG;
    for (const m of notes) {
      const f0 = midiHz(m);
      for (const cents of detunes) {
        const f = f0 * 2 ** (cents / 1200);
        const phase0 = (seg * 0.37 + m * 0.11) % 1; // deterministic spread
        // Fundamental + soft octave + faint 12th = low-passed pad timbre.
        for (let i = -XF; i < SEG + XF; i++) {
          const idx = (segStart + i + total) % total; // wrap-aware
          const t = (segStart + i) / SR;
          // Raised-cosine segment envelope with crossfade tails.
          let env = 1;
          if (i < XF) env = 0.5 - 0.5 * Math.cos((Math.PI * (i + XF)) / (2 * XF));
          else if (i > SEG - XF) env = 0.5 + 0.5 * Math.cos((Math.PI * (i - (SEG - XF))) / (2 * XF));
          const w = 2 * Math.PI * f * t + phase0 * 2 * Math.PI;
          const sample =
            Math.sin(w) + 0.3 * Math.sin(2 * w + 0.5) + 0.12 * Math.sin(3 * w + 1.1);
          out[idx] += (env * sample) / (notes.length * detunes.length * 1.42);
        }
      }
    }
  }
  // Slow tremolo so the bed breathes (0.09 Hz, ±15%).
  for (let i = 0; i < total; i++) {
    out[i] *= 1 - 0.15 * (0.5 + 0.5 * Math.sin((2 * Math.PI * 0.09 * i) / SR));
  }
  return normalize(out, 0.5);
}

// ── Room tone: 12s brown-noise ambience, seamless loop ──────────────────────
function roomTone() {
  const total = 12 * SR;
  const rnd = mulberry32(1976);
  const out = new Float64Array(total);
  let brown = 0;
  for (let i = 0; i < total; i++) {
    brown = (brown + 0.02 * (rnd() * 2 - 1)) * 0.999;
    out[i] = brown;
  }
  // Loop seam: crossfade last 0.5s into the first 0.5s.
  const XF = Math.floor(0.5 * SR);
  for (let i = 0; i < XF; i++) {
    const a = i / XF;
    out[total - XF + i] = out[total - XF + i] * (1 - a) + out[i] * a;
  }
  return normalize(out, 0.3);
}

// ── SFX ─────────────────────────────────────────────────────────────────────
function whoosh() {
  const total = Math.floor(0.6 * SR);
  const rnd = mulberry32(41);
  const out = new Float64Array(total);
  let lp = 0;
  let rumble = 0;
  for (let i = 0; i < total; i++) {
    const t = i / total;
    // Amplitude: rise to 40%, fall away.
    const env = t < 0.4 ? Math.sin((Math.PI * t) / 0.8) : Math.cos((Math.PI * (t - 0.4)) / 1.2);
    // Swept one-pole low-pass: 300 → 2500 → 800 Hz.
    const fc = t < 0.5 ? 300 + 4400 * t : 2500 - 3400 * (t - 0.5);
    const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
    lp += a * ((rnd() * 2 - 1) - lp);
    rumble += 0.002 * (lp - rumble); // slow tracker → subtract to de-rumble
    out[i] = (lp - rumble) * Math.max(0, env);
  }
  return normalize(out, 0.9);
}

function tick() {
  const total = Math.floor(0.08 * SR);
  const rnd = mulberry32(7);
  const out = new Float64Array(total);
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    const body = Math.sin(2 * Math.PI * 1900 * t) * Math.exp(-t / 0.015);
    const click = i < SR * 0.003 ? (rnd() * 2 - 1) * 0.4 : 0;
    out[i] = body + click;
  }
  return normalize(out, 0.9);
}

function chime() {
  const total = Math.floor(0.9 * SR);
  const out = new Float64Array(total);
  const partials = [
    [880, 1.0, 0.35],
    [876, 0.4, 0.35], // detuned shimmer
    [1318.5, 0.5, 0.25],
    [1760, 0.25, 0.18],
  ];
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    const attack = Math.min(1, t / 0.008);
    let s = 0;
    for (const [f, amp, tau] of partials) {
      s += amp * Math.sin(2 * Math.PI * f * t) * Math.exp(-t / tau);
    }
    out[i] = s * attack;
  }
  return normalize(out, 0.8);
}

// ── Main ────────────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true });
writeWav(join(OUT_DIR, "music-bed.wav"), musicBed());
writeWav(join(OUT_DIR, "room-tone.wav"), roomTone());
writeWav(join(OUT_DIR, "sfx-whoosh.wav"), whoosh());
writeWav(join(OUT_DIR, "sfx-tick.wav"), tick());
writeWav(join(OUT_DIR, "sfx-chime.wav"), chime());
console.log("audio assets generated");
