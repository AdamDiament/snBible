import { DEFAULT_PAGE, estimateHeight, layoutTextBox, textFrame } from '../src/layout';

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

describe('textFrame', () => {
  test('documented values', () => {
    expect(textFrame({ border: false })).toEqual({ textFrameStyle: 0 });
    expect(textFrame({ border: true })).toEqual({ textFrameStyle: 3 });
  });
});

describe('spaced layout height', () => {
  test('blank lines between verses make the box taller', () => {
    const lines = 'a\nb\nc';
    const spaced = 'a\n\nb\n\nc';
    expect(estimateHeight(spaced, 1000, 30)).toBeGreaterThan(estimateHeight(lines, 1000, 30));
  });
});

describe('frame test (temporary)', () => {
  const { frameTestFields, frameTestLabel, stackBox } = require('../src/frameTest');

  test('fields and label', () => {
    expect(frameTestFields({ mode: '1', fill: 'none', text: 'default' })).toEqual({ textFrameStyle: 1, textFrameWidth: 3, textFrameStrokeColor: 0 });
    expect(frameTestFields({ mode: '2', fill: '128', text: 'white255' })).toMatchObject({ textFrameFillColor: 128, textColor: 255 });
    expect(frameTestLabel({ mode: '0', fill: '200', text: 'whiteArgb' })).toBe('[mode 0 · fill 200 · text whiteArgb]');
  });

  test('stacks boxes down the page and wraps, keeping integer in-page rects', () => {
    const base = layoutTextBox(short, DEFAULT_PAGE, { textSize: 'medium', placement: 'top' });
    const tops = [0, 1, 2].map(i => stackBox(base, DEFAULT_PAGE, i).textRect.top);
    expect(tops[1]).toBeGreaterThan(tops[0]);
    expect(tops[2]).toBeGreaterThan(tops[1]);
    for (let i = 0; i < 40; i++) {
      const r = stackBox(base, DEFAULT_PAGE, i).textRect;
      expect(Number.isInteger(r.top) && Number.isInteger(r.bottom)).toBe(true);
      expect(r.bottom).toBeLessThanOrEqual(DEFAULT_PAGE.height);
    }
    expect(stackBox(base, DEFAULT_PAGE, 1000).textRect.top).toBeLessThan(DEFAULT_PAGE.height);
  });
});
