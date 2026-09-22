import { bollinger, rsi, sma } from '../src/indicators.js';

describe('sma', () => {
  test('averages the trailing window and pads the warm-up with null', () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });

  test('returns all nulls when there is not enough data', () => {
    expect(sma([1, 2], 3)).toEqual([null, null]);
  });
});

describe('bollinger', () => {
  test('bands collapse onto the average for a flat series', () => {
    const bands = bollinger([5, 5, 5, 5], 3, 2);
    expect(bands[1]).toEqual({ upper: null, middle: null, lower: null });
    expect(bands[3]).toEqual({ upper: 5, middle: 5, lower: 5 });
  });

  test('bands sit two population standard deviations from the average', () => {
    // window [2, 4, 6]: mean 4, population sd sqrt(8/3)
    const { upper, middle, lower } = bollinger([2, 4, 6], 3, 2)[2];
    const sd = Math.sqrt(8 / 3);
    expect(middle).toBe(4);
    expect(upper).toBeCloseTo(4 + 2 * sd);
    expect(lower).toBeCloseTo(4 - 2 * sd);
  });
});

describe('rsi', () => {
  test('is 100 for a series that only rises', () => {
    const values = Array.from({ length: 20 }, (_, i) => i + 1);
    const out = rsi(values, 14);
    expect(out.slice(0, 14).every((v) => v === null)).toBe(true);
    expect(out[14]).toBe(100);
    expect(out[19]).toBe(100);
  });

  test('is 0 for a series that only falls and 50 for a flat one', () => {
    const falling = Array.from({ length: 16 }, (_, i) => 100 - i);
    expect(rsi(falling, 14)[15]).toBe(0);
    expect(rsi(new Array(16).fill(7), 14)[15]).toBe(50);
  });

  test('stays between 0 and 100 for mixed moves', () => {
    const values = [44, 44.3, 44.1, 43.6, 44.3, 44.8, 45.1, 45.4, 45.8, 46.1, 45.9, 46.2, 45.6, 46.3, 46.3, 46, 46.4];
    const out = rsi(values, 14).filter((v) => v !== null);
    expect(out.length).toBe(3);
    out.forEach((v) => {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(100);
    });
  });
});
