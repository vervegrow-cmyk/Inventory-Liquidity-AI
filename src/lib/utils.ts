export function parseJson(text: string): Record<string, unknown> | null {
  try { return JSON.parse(text.trim()) as Record<string, unknown>; } catch { /* */ }
  const stripped = text.replace(/```(?:json)?/gi, '').trim();
  try { return JSON.parse(stripped) as Record<string, unknown>; } catch { /* */ }
  let depth = 0, start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') { if (depth === 0) start = i; depth++; }
    else if (text[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        try { return JSON.parse(text.slice(start, i + 1)) as Record<string, unknown>; } catch { start = -1; }
      }
    }
  }
  return null;
}

/**
 * Parse a price string (possibly a range like "$28-33") to a number.
 * For ranges, returns the midpoint. Strips $, ¥, commas, spaces.
 */
export function parsePrice(s: string | number | undefined | null): number {
  if (s === null || s === undefined) return 0;
  if (typeof s === 'number') return isNaN(s) ? 0 : s;
  const clean = s.replace(/[¥$,\s]/g, '');
  const rangeMatch = clean.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    return (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2;
  }
  const scalar = clean.match(/^(\d+(?:\.\d+)?)$/);
  return scalar ? parseFloat(scalar[1]) : 0;
}

export function findByKeywords(obj: Record<string, string>, kws: string[]): string {
  for (const kw of kws) {
    const found = Object.entries(obj).find(([k]) =>
      k.toLowerCase().includes(kw.toLowerCase())
    );
    if (found) return found[1];
  }
  return '';
}
