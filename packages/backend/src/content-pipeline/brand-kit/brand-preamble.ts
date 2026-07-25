// packages/backend/src/content-pipeline/brand-kit/brand-preamble.ts
//
// Builds the prompt preamble a generator prepends to its user prompt. Extracted
// from BrandKitService to keep that file under the size limit.
//
// The em-dash ban and the never-name-competitors rule are FIXED (always emitted)
// regardless of any stored flag — per the brand guide these are not optional, so
// they are not exposed as editable in UpdateBrandDto (see brand-kit.types.ts).

import type { BrandProfile } from './brand-kit.types';

/** Turn a brand profile into the voice + hard-rules preamble for generation. */
export function buildBrandPromptPreamble(profile: BrandProfile): string {
  const c = profile.approvedCopy;
  const lines: string[] = [];
  lines.push(`You are the in-house content writer for ${profile.name}.`);
  if (profile.voiceSummary) lines.push(profile.voiceSummary);
  lines.push(`Voice: ${profile.tone.shorthand}.`);
  lines.push('');
  lines.push('HARD RULES (content is rejected if any are broken):');
  // Always-on, not driven by a stored flag (brand-guide-mandated).
  lines.push(
    '- Do NOT use em dashes or en dashes. Use a period, comma, or colon.',
  );
  lines.push(
    `- Do NOT use hype phrases: ${c.bans.hypePhrases.slice(0, 12).join(', ')}.`,
  );
  // Always-on, not driven by a stored flag (brand-guide-mandated).
  lines.push(
    `- Never name competitors (${c.bans.competitors.join(', ')}) or any rival product.`,
  );
  lines.push(`- ${c.scoreLanguage.rule}`);
  lines.push(
    `- Momentum words allowed for a score: ${c.scoreLanguage.allowedMomentumWords.join(', ')}. Never quality words: ${c.scoreLanguage.bannedQualityWords.join(', ')}.`,
  );
  lines.push(
    `- Establish "PropertyIQ Score" (or "PIQ Score") before referring to "the score".`,
  );
  lines.push('');
  lines.push('APPROVED COPY (use verbatim, do not remix):');
  lines.push(`- Coverage stat (only this one): ${c.coverageStat}.`);
  lines.push(`- Taglines: ${c.taglines.map((t) => `"${t}"`).join('; ')}.`);
  lines.push(`- Sign-offs: ${c.signOffs.map((t) => `"${t}"`).join('; ')}.`);
  lines.push(
    `- When mentioning the free tier, include: ${c.freeTierFraming.map((t) => `"${t}"`).join(', ')}.`,
  );
  if (profile.products.length) {
    lines.push('');
    lines.push('PRODUCT CONTEXT:');
    for (const p of profile.products) lines.push(`- ${p.name}: ${p.summary}`);
  }
  return lines.join('\n');
}
