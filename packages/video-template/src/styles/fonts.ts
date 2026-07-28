import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Self-hosted brand fonts (public/fonts/, variable woff2, latin subset).
 * Vendored instead of @remotion/google-fonts so renders need no network
 * and dev/prod/CI rasterize identically — the Railway render container
 * ships no Roboto, and falling back to system fonts silently changed
 * typography per environment before this.
 */
const FACES = [
  { family: "Roboto", file: "fonts/roboto-var.woff2" },
  { family: "Roboto Mono", file: "fonts/roboto-mono-var.woff2" },
] as const;

let started = false;

/** Idempotent; called once from Root. Blocks rendering until fonts load. */
export function loadBrandFonts(): void {
  if (started || typeof document === "undefined") return;
  started = true;
  const handle = delayRender("brand fonts");
  Promise.all(
    FACES.map((f) =>
      new FontFace(f.family, `url(${staticFile(f.file)})`, {
        weight: "100 900",
      })
        .load()
        .then((face) => document.fonts.add(face)),
    ),
  )
    .then(() => continueRender(handle))
    .catch((err) => {
      // Fallback stacks in FONTS still render — never wedge the render.
      // eslint-disable-next-line no-console
      console.warn("brand font load failed", err);
      continueRender(handle);
    });
}
