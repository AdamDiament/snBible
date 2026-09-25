import { formatSpans, parseReference, Span } from '../src/reference';

function label(input: string): string {
  const r = parseReference(input);
  if (!r.ok) {
    throw new Error(`${input}: ${r.error}`);
  }
  return formatSpans(r.spans);
}

function spans(input: string): Array<[string, number, number | null, number, number | null]> {
  const r = parseReference(input);
  if (!r.ok) {
    throw new Error(`${input}: ${r.error}`);
  }
  return r.spans.map((s: Span) => [s.book.id, s.startChapter, s.startVerse, s.endChapter, s.endVerse]);
}

function error(input: string): string {
  const r = parseReference(input);
  if (r.ok) {
    throw new Error(`${input}: expected an error, got ${formatSpans(r.spans)}`);
  }
  return r.error;
}

describe('parseReference + formatSpans', () => {
  test.each([
    ['genesis 1:1-5', 'Genesis 1:1–5'],
    ['Gen 1', 'Genesis 1'],
    ['Jn 3:16', 'John 3:16'],
    ['1 Cor 13:4-7', '1 Corinthians 13:4–7'],
    ['Ps 23', 'Psalm 23'],
    ['Rom 8:38-9:2', 'Romans 8:38–9:2'],
    ['Jude 3-5', 'Jude 3–5'],
    ['John 3:16, 18-21', 'John 3:16, 18–21'],
    ['Gen 1-2', 'Genesis 1–2'],
    ['first john 1:9', '1 John 1:9'],
    ['I John 4:8', '1 John 4:8'],
    ['Gen. 1:1', 'Genesis 1:1'],
    ['Philemon 1:6', 'Philemon 6'],
    ['Philemon 6', 'Philemon 6'],
    ['deuter 6:4', 'Deuteronomy 6:4'],
    ['Gen 1:1–5', 'Genesis 1:1–5'],
    ['Isa 52:13-53:12', 'Isaiah 52:13–53:12'],
    ['Ps 1-2', 'Psalms 1–2'],
    ['II Kings 2:11', '2 Kings 2:11'],
    ['Song of Songs 2:1', 'Song of Solomon 2:1'],
  ])('%s → %s', (input, expected) => {
    expect(label(input)).toBe(expected);
  });

  test('span shapes', () => {
    expect(spans('genesis 1:1-5')).toEqual([['GEN', 1, 1, 1, 5]]);
    expect(spans('Gen 1')).toEqual([['GEN', 1, null, 1, null]]);
    expect(spans('Gen 1-2')).toEqual([['GEN', 1, null, 2, null]]);
    expect(spans('Rom 8:38-9:2')).toEqual([['ROM', 8, 38, 9, 2]]);
    expect(spans('Jude 3-5')).toEqual([['JUD', 1, 3, 1, 5]]);
    expect(spans('John 3:16, 18-21')).toEqual([
      ['JHN', 3, 16, 3, 16],
      ['JHN', 3, 18, 3, 21],
    ]);
    expect(spans('Philemon 1:6')).toEqual([['PHM', 1, 6, 1, 6]]);
  });

  test('errors', () => {
    expect(error('Genesis 51')).toMatch(/50 chapters/);
    expect(error('John 3:5-2')).toMatch(/before the start/);
    expect(error('jo 1:1')).toMatch(/could be .*Type more/);
    expect(error('')).toMatch(/Type a reference/);
    expect(error('Hezekiah 1:1')).toMatch(/No book/);
    expect(error('John')).toMatch(/Add a chapter/);
    expect(error('John 3:0')).toMatch(/start at 1/);
  });
});
