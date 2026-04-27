/**
 * Detect narrative mentions of PropertyIQ **data confidence** letters (A–F),
 * distinct from numeric PropertyIQ Score (1–99) or word grades (GOOD, FAIR).
 *
 * Matches phrases like "confidence level B", "B-grade confidence",
 * "confidence ... A" within a short window.
 */
export interface ConfidenceLetterMention {
  letter: string;
  quote: string;
}

export function extractDataConfidenceMentions(
  scriptText: string,
): ConfidenceLetterMention[] {
  const out: ConfidenceLetterMention[] = [];
  const patterns: RegExp[] = [
    /\bconfidence\b[^.!?\n]{0,140}?\b([A-F])\b/gi,
    /\b([A-F])\b[^.!?\n]{0,60}?\bconfidence\b/gi,
    /\b([A-F])-grade\s+confidence\b/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(scriptText)) !== null) {
      const letter = (m[1] ?? '').toUpperCase();
      if (!/^[A-F]$/.test(letter)) continue;
      const start = Math.max(0, m.index - 50);
      const quote = scriptText
        .slice(start, m.index + m[0].length + 60)
        .trim()
        .replace(/\s+/g, ' ');
      out.push({ letter, quote });
    }
  }
  return out;
}
