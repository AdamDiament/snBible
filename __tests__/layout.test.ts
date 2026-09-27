import { DEFAULT_PAGE, estimateHeight, layoutTextBox } from '../src/layout';

const MANTA = { width: 1920, height: 2560 };
const short = 'John 3:16 (BSB)\n16 For God so loved the world that He gave His one and only Son…';
const long = Array.from({ length: 30 }, (_, i) => `${i + 1} ${'word '.repeat(30)}`).join(' ');

describe('layoutTextBox', () => {
  test.each([
    ['A5X', DEFAULT_PAGE],
    ['Manta', MANTA],
    ['fractional', { width: 1404.6, height: 1871.4 }],
  ])('%s: integer rect with non-zero area, inside the page', (_, page) => {
    for (const textSize of ['small', 'medium', 'large'] as const) {
      for (const placement of ['top', 'middle'] as const) {
        for (const text of [short, long, '']) {
          const { textRect: r, fontSize } = layoutTextBox(text, page, { textSize, placement });
          for (const n of [r.left, r.top, r.right, r.bottom, fontSize]) {
            expect(Number.isInteger(n)).toBe(true);
          }
          expect(r.right - r.left).toBeGreaterThan(0);
          expect(r.bottom - r.top).toBeGreaterThan(0);
          expect(r.left).toBeGreaterThanOrEqual(0);
          expect(r.top).toBeGreaterThanOrEqual(0);
          expect(r.right).toBeLessThanOrEqual(Math.round(page.width));
          expect(r.bottom).toBeLessThanOrEqual(Math.round(page.height));
        }
      }
    }
  });

  test('font sizes follow the page width', () => {
    expect(layoutTextBox(short, DEFAULT_PAGE, { textSize: 'small', placement: 'top' }).fontSize).toBe(25);
    expect(layoutTextBox(short, DEFAULT_PAGE, { textSize: 'medium', placement: 'top' }).fontSize).toBe(31);
    expect(layoutTextBox(short, MANTA, { textSize: 'large', placement: 'top' }).fontSize).toBe(52);
  });

  test('a short passage fits; 30 long verses overflow at Medium', () => {
    expect(layoutTextBox(short, DEFAULT_PAGE, { textSize: 'medium', placement: 'top' }).overflow).toBe(false);
    const big = layoutTextBox(long, DEFAULT_PAGE, { textSize: 'medium', placement: 'top' });
    expect(big.overflow).toBe(true);
    // The frame is capped to the page even when the text is longer.
    expect(big.textRect.bottom).toBeLessThanOrEqual(DEFAULT_PAGE.height - Math.round(DEFAULT_PAGE.width * 0.07));
  });

  test('centred placement puts the box in the middle', () => {
    const { textRect: r } = layoutTextBox(short, DEFAULT_PAGE, { textSize: 'medium', placement: 'middle' });
    expect(Math.abs(r.top + (r.bottom - r.top) / 2 - DEFAULT_PAGE.height / 2)).toBeLessThanOrEqual(1);
  });
});

describe('estimateHeight', () => {
  test('grows with the number of lines', () => {
    const one = estimateHeight('a', 1000, 30);
    expect(estimateHeight('a\nb\nc', 1000, 30)).toBeGreaterThan(one);
    expect(estimateHeight('x'.repeat(1000), 1000, 30)).toBeGreaterThan(one);
  });
});

describe('spaced layout height', () => {
  test('blank lines between verses make the box taller', () => {
    const lines = 'a\nb\nc';
    const spaced = 'a\n\nb\n\nc';
    expect(estimateHeight(spaced, 1000, 30)).toBeGreaterThan(estimateHeight(lines, 1000, 30));
  });
});

describe('layoutTextBox anchors', () => {
  const s = { textSize: 'medium', placement: 'below' } as const;

  test('below: just under the last writing, or near the top on an empty page', () => {
    const under = layoutTextBox(short, DEFAULT_PAGE, s, { below: 600 });
    expect(under.textRect.top).toBeGreaterThan(600);
    expect(under.textRect.top).toBeLessThan(650);
    expect(under.room).toBe(true);
    expect(layoutTextBox(short, DEFAULT_PAGE, s, { below: null }).textRect.top).toBe(Math.round(DEFAULT_PAGE.height * 0.08));
  });

  test('no room below: moved up to fit, and flagged', () => {
    const full = layoutTextBox(short, DEFAULT_PAGE, s, { below: 1800 });
    expect(full.room).toBe(false);
    expect(full.textRect.bottom).toBeLessThanOrEqual(DEFAULT_PAGE.height);
  });

  test('an exact spot keeps its top, left and right', () => {
    const r = layoutTextBox(short, DEFAULT_PAGE, s, { top: 333.4, left: 200, right: 1000 }).textRect;
    expect(r).toMatchObject({ top: 333, left: 200, right: 1000 });
  });

  test('a box too narrow to read falls back to the page margins', () => {
    const r = layoutTextBox(short, DEFAULT_PAGE, s, { top: 100, left: 500, right: 540 }).textRect;
    expect(r.left).toBe(Math.round(DEFAULT_PAGE.width * 0.07));
  });
});
