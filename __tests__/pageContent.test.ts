import { elementBottom, ElementLike, latestElement } from '../src/pageContent';

jest.mock('sn-plugin-lib', () => ({ PluginFileAPI: {}, PointUtils: {} }));

// Fake EMR→pixel: EMR x runs down a portrait page.
const emrToPx = (p: { x: number; y: number }) => ({ x: p.y / 10, y: p.x / 10 });
const accessor = <T,>(items: T[]) => ({ size: async () => items.length, getRange: async () => items });

describe('elementBottom', () => {
  test('text boxes use their pixel rect', async () => {
    const el: ElementLike = { type: 500, textBox: { textRect: { bottom: 640 } } };
    await expect(elementBottom(el, emrToPx)).resolves.toBe(640);
  });

  test('strokes use their lowest converted point', async () => {
    const el: ElementLike = { type: 0, stroke: { points: accessor([{ x: 5000, y: 100 }, { x: 7200, y: 90 }, { x: 6000, y: 300 }]) } };
    await expect(elementBottom(el, emrToPx)).resolves.toBe(720);
  });

  test('geometry uses its pixel points', async () => {
    const el: ElementLike = { type: 700, geometry: { points: [{ x: 1, y: 300 }, { x: 2, y: 410 }] } };
    await expect(elementBottom(el, emrToPx)).resolves.toBe(410);
  });

  test('anything else falls back to its EMR contours', async () => {
    const el: ElementLike = { type: 100, contoursSrc: accessor([[{ x: 1000, y: 0 }], [{ x: 2500, y: 0 }]]) };
    await expect(elementBottom(el, emrToPx)).resolves.toBe(250);
  });

  test('null when there is nothing to measure', async () => {
    await expect(elementBottom({ type: 0, stroke: { points: accessor([]) } }, emrToPx)).resolves.toBeNull();
    await expect(elementBottom({ type: 800 }, emrToPx)).resolves.toBeNull();
  });
});

describe('latestElement', () => {
  test('picks the highest numInPage, whatever the list order', () => {
    expect(latestElement([{ numInPage: 3 }, { numInPage: 7 }, { numInPage: 5 }])).toEqual({ numInPage: 7 });
    expect(latestElement([])).toBeNull();
  });
});
