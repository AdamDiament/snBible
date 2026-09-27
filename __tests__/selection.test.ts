import { MAX_VERSES, Selection, selectionRange, selectionStatus, tapVerse } from '../src/selection';

const taps = (...vs: number[]) => vs.reduce<Selection>((s, v) => tapVerse(s, v), null);

describe('verse selection', () => {
  test('first tap selects one verse and waits for the second', () => {
    const s = taps(5);
    expect(s).toEqual({ anchor: 5, other: null, clamped: false });
    expect(selectionRange(s)).toEqual({ lo: 5, hi: 5 });
  });

  test('taps work in either order', () => {
    expect(selectionRange(taps(3, 9))).toEqual({ lo: 3, hi: 9 });
    expect(selectionRange(taps(9, 3))).toEqual({ lo: 3, hi: 9 });
  });

  test('tapping the same verse twice selects just that verse', () => {
    expect(selectionRange(taps(7, 7))).toEqual({ lo: 7, hi: 7 });
  });

  test('a third tap starts a new selection', () => {
    expect(taps(3, 9, 12)).toEqual({ anchor: 12, other: null, clamped: false });
    expect(selectionRange(taps(3, 9, 12, 1))).toEqual({ lo: 1, hi: 12 });
  });

  test(`ranges are capped at ${MAX_VERSES} verses, counted from the first tap`, () => {
    expect(MAX_VERSES).toBe(30);
    const down = taps(1, 176);
    expect(selectionRange(down)).toEqual({ lo: 1, hi: 30 });
    expect(down?.clamped).toBe(true);

    const up = taps(100, 1);
    expect(selectionRange(up)).toEqual({ lo: 71, hi: 100 });
    expect(up?.clamped).toBe(true);

    const exact = taps(1, 30);
    expect(selectionRange(exact)).toEqual({ lo: 1, hi: 30 });
    expect(exact?.clamped).toBe(false);
  });

  test('status line', () => {
    expect(selectionStatus(null, '')).toBe('Tap the first and last verse, in either order (up to 30).');
    expect(selectionStatus(taps(5), 'John 3:5')).toMatch(/^Verse 5 selected\. Tap another verse/);
    expect(selectionStatus(taps(18, 16), 'John 3:16–18')).toBe('John 3:16–18  ·  3 verses');
    expect(selectionStatus(taps(16, 16), 'John 3:16')).toBe('John 3:16  ·  1 verse');
    expect(selectionStatus(taps(1, 50), 'Psalm 119:1–30')).toBe('Psalm 119:1–30  ·  30 verses, the most at once');
  });
});
