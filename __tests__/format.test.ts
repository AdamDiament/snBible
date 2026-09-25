import type { VerseRow } from '../src/bibleSource';
import { buildText, DEFAULT_SETTINGS, Settings } from '../src/format';

const rows: VerseRow[] = [
  { chapter: 3, verse: 16, text: 'For God so loved the world…' },
  { chapter: 3, verse: 17, text: 'For God did not send His Son…' },
];

const crossChapter: VerseRow[] = [
  { chapter: 8, verse: 39, text: 'neither height nor depth…' },
  { chapter: 9, verse: 1, text: 'I speak the truth in Christ…' },
  { chapter: 9, verse: 2, text: 'I have great sorrow…' },
];

const build = (r: VerseRow[], label: string, patch: Partial<Settings> = {}) =>
  buildText(r, label, { ...DEFAULT_SETTINGS, ...patch });

describe('buildText', () => {
  test('defaults: plain numbers, paragraph, reference above with (BSB)', () => {
    expect(build(rows, 'John 3:16–17')).toBe(
      'John 3:16–17 (BSB)\n16 For God so loved the world… 17 For God did not send His Son…',
    );
  });

  test('superscript verse numbers', () => {
    expect(build(rows, 'John 3:16–17', { verseNumbers: 'superscript', reference: 'off' })).toBe(
      '¹⁶For God so loved the world… ¹⁷For God did not send His Son…',
    );
  });

  test('no verse numbers, one verse per line', () => {
    expect(build(rows, 'John 3:16–17', { verseNumbers: 'off', layout: 'lines', reference: 'off' })).toBe(
      'For God so loved the world…\nFor God did not send His Son…',
    );
  });

  test('reference below, without translation', () => {
    expect(build(rows.slice(0, 1), 'John 3:16', { reference: 'bottom', includeTranslation: false })).toBe(
      '16 For God so loved the world…\n— John 3:16',
    );
  });

  test('multi-chapter selections mark the first verse of each chapter with chapter:verse', () => {
    expect(build(crossChapter, 'Romans 8:39–9:2', { reference: 'off' })).toBe(
      '8:39 neither height nor depth… 9:1 I speak the truth in Christ… 2 I have great sorrow…',
    );
    expect(build(crossChapter, 'Romans 8:39–9:2', { reference: 'off', verseNumbers: 'superscript' })).toBe(
      '⁸:³⁹neither height nor depth… ⁹:¹I speak the truth in Christ… ²I have great sorrow…',
    );
  });
});
