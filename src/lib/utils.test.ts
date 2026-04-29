import { describe, it, expect } from 'vitest';
import { parsePrice, parseJson, findByKeywords } from './utils';

describe('parsePrice', () => {
  // ── Null / undefined / empty ──────────────────────────────────────────────
  it('returns 0 for undefined', () => {
    expect(parsePrice(undefined)).toBe(0);
  });

  it('returns 0 for null', () => {
    expect(parsePrice(null)).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(parsePrice('')).toBe(0);
  });

  // ── Plain numbers ─────────────────────────────────────────────────────────
  it('passes through a numeric value unchanged', () => {
    expect(parsePrice(150)).toBe(150);
  });

  it('returns 0 for NaN numeric input', () => {
    expect(parsePrice(NaN)).toBe(0);
  });

  // ── Plain price strings ───────────────────────────────────────────────────
  it('strips $ and parses integer', () => {
    expect(parsePrice('$30')).toBe(30);
  });

  it('strips ¥ and parses integer (backward compat)', () => {
    expect(parsePrice('¥28')).toBe(28);
  });

  it('strips commas from thousand-separated value', () => {
    expect(parsePrice('$1,200')).toBe(1200);
  });

  it('parses decimal price', () => {
    expect(parsePrice('$30.5')).toBe(30.5);
  });

  // ── Range strings (the core bug fix) ─────────────────────────────────────
  it('returns midpoint for "$28-33"', () => {
    // Regression: old code → parseFloat("2833") = 2833, displayed as $2,833
    expect(parsePrice('$28-33')).toBe(30.5);
  });

  it('returns midpoint for range without currency symbol', () => {
    expect(parsePrice('28-33')).toBe(30.5);
  });

  it('returns midpoint for range with ¥ symbol (backward compat)', () => {
    expect(parsePrice('¥10-20')).toBe(15);
  });

  it('handles range where both bounds are equal', () => {
    expect(parsePrice('$50-50')).toBe(50);
  });

  it('handles decimal range "$28.5-33.5"', () => {
    expect(parsePrice('$28.5-33.5')).toBe(31);
  });

  // ── Comma-separated thousands inside range ────────────────────────────────
  it('parses "$1,000-2,000" range with commas correctly', () => {
    // After stripping commas: "1000-2000" → midpoint 1500
    expect(parsePrice('$1,000-2,000')).toBe(1500);
  });

  // ── Strings that are not valid ranges ─────────────────────────────────────
  it('does NOT treat a bare negative string as a range', () => {
    // "-30" has no left-hand number → falls back to 0
    expect(parsePrice('-30')).toBe(0);
  });
});

describe('parseJson', () => {
  it('parses clean JSON object', () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('parses JSON with leading/trailing whitespace', () => {
    expect(parseJson('  {"b": 2}  ')).toEqual({ b: 2 });
  });

  it('strips markdown code fences and parses', () => {
    expect(parseJson('```json\n{"c":3}\n```')).toEqual({ c: 3 });
  });

  it('strips plain code fences and parses', () => {
    expect(parseJson('```\n{"d":4}\n```')).toEqual({ d: 4 });
  });

  it('extracts embedded JSON object from surrounding text', () => {
    expect(parseJson('some text {"e":5} more text')).toEqual({ e: 5 });
  });

  it('returns null for non-JSON text', () => {
    expect(parseJson('not json at all')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseJson('')).toBeNull();
  });
});

describe('findByKeywords', () => {
  const obj = { ItemName: 'Widget', brandName: 'Acme', price: '100' };

  it('finds value by exact keyword match', () => {
    expect(findByKeywords(obj, ['price'])).toBe('100');
  });

  it('matches keyword case-insensitively', () => {
    expect(findByKeywords(obj, ['itemname'])).toBe('Widget');
  });

  it('returns first match when multiple keywords given', () => {
    expect(findByKeywords(obj, ['brandname', 'price'])).toBe('Acme');
  });

  it('returns empty string when no keyword matches', () => {
    expect(findByKeywords(obj, ['sku', 'upc'])).toBe('');
  });

  it('returns empty string for empty keywords array', () => {
    expect(findByKeywords(obj, [])).toBe('');
  });
});
