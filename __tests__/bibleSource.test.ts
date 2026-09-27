import { findBook, Book } from '../src/books';
import { parseReference } from '../src/reference';
import { resolveSpans } from '../src/bibleSource';

// bibleSource only needs PluginManager for the online fallback, which these tests never reach.
jest.mock('sn-plugin-lib', () => ({ PluginManager: {} }));

const spans = (ref: string) => {
  const r = parseReference(ref);
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.spans;
};

describe('resolveSpans (bundled text)', () => {
  test('resolves a range to verse rows', async () => {
    const rows = await resolveSpans(spans('John 3:16-18'));
    expect(rows.map(r => r.verse)).toEqual([16, 17, 18]);
    expect(rows[0].text).toMatch(/^For God so loved the world/);
  });

  test('crosses chapters and skips verses the BSB omits', async () => {
    const rows = await resolveSpans(spans('Matt 17:20-22'));
    expect(rows.map(r => `${r.chapter}:${r.verse}`)).toEqual(['17:20', '17:22']);
    const cross = await resolveSpans(spans('Rom 8:38-9:2'));
    expect(cross.map(r => `${r.chapter}:${r.verse}`)).toEqual(['8:38', '8:39', '9:1', '9:2']);
  });

  test('allows exactly the limit and rejects one more', async () => {
    await expect(resolveSpans(spans('Ps 119:1-30'), 30)).resolves.toHaveLength(30);
    await expect(resolveSpans(spans('Ps 119:1-31'), 30)).rejects.toThrow(/more than 30 verses/);
    await expect(resolveSpans(spans('Gen 1'), 30)).rejects.toThrow(/more than 30 verses/);
    await expect(resolveSpans(spans('Ps 23'), 30)).resolves.toHaveLength(6);
  });

  test('stops reading chapters once over the limit', async () => {
    // Genesis 1–50 would be 1,533 verses; the cap should bail out in chapter 1 or 2.
    await expect(resolveSpans(spans('Gen 1-50'), 30)).rejects.toThrow(/more than 30/);
  });

  test('reports verses past the end of a chapter', async () => {
    const jude = findBook('Jude') as Book;
    await expect(resolveSpans([{ book: jude, startChapter: 1, startVerse: 30, endChapter: 1, endVerse: 31 }])).rejects.toThrow(
      /has only 25 verses/,
    );
  });
});
