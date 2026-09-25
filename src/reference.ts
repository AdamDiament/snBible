import { BOOKS, Book, findBook } from './books';

/**
 * A contiguous span inside one book. `startVerse`/`endVerse` of `null`
 * mean "from the start of the chapter" / "to the end of the chapter".
 */
export type Span = {
  book: Book;
  startChapter: number;
  startVerse: number | null;
  endChapter: number;
  endVerse: number | null;
};

export type ParseResult =
  | { ok: true; spans: Span[] }
  | { ok: false; error: string };

/**
 * Parse free-text references such as:
 *   genesis 1:1-5 · Gen 1 · Jn 3:16 · 1 Cor 13:4-7 · Ps 23
 *   Rom 8:38-9:2 · Isa 52:13-53:12 · Jude 3 · John 3:16, 18-21 · Gen 1-2
 *   first john 1:9 · Song of Songs 2:1 · Matt 5:3–12 (en/em dashes are fine)
 */
export function parseReference(input: string): ParseResult {
  const text = input
    .replace(/[\u2010-\u2015\u2212]/g, '-') // any dash → hyphen
    .replace(/\s*-\s*/g, '-')
    .replace(/(\d)\s*[:.]\s*(?=\d)/g, '$1:') // "1.5" or "1 : 5" → "1:5"
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) { return { ok: false, error: 'Type a reference, for example John 3:16-18.' }; }

  // Book part = optional leading 1-3 / roman / "first" etc, then letters/spaces.
  const m = text.match(/^((?:[1-3]|i{1,3}|first|second|third|1st|2nd|3rd)?\s*[A-Za-z][A-Za-z .]*?)\s*(\d[\d:,;\- ]*)?$/i);
  if (!m) { return { ok: false, error: `Couldn't read "${input}". Try a form like Genesis 1:1-5.` }; }

  const found = findBook(m[1]);
  if (!found) { return { ok: false, error: `No book called "${m[1].trim()}".` }; }
  if (Array.isArray(found)) {
    return { ok: false, error: `"${m[1].trim()}" could be ${found.map(b => b.name).join(', ')}. Type more of the name.` };
  }
  const book = found;
  const numbers = (m[2] ?? '').replace(/\s/g, '');
  if (!numbers) {
    return { ok: false, error: `Add a chapter, for example ${book.name} 1${book.chapters === 1 ? ':1' : ''}.` };
  }

  const spans: Span[] = [];
  let ctxChapter: number | null = null; // chapter context for bare verse numbers after a comma
  const single = book.chapters === 1;

  for (const seg of numbers.split(/[,;]/).filter(Boolean)) {
    const parts = seg.split('-');
    if (parts.length > 2 || parts.some(p => p === '')) {
      return { ok: false, error: `Couldn't read "${seg}".` };
    }
    const a = parsePoint(parts[0]);
    const b = parts[1] !== undefined ? parsePoint(parts[1]) : null;
    if (!a || (parts[1] !== undefined && !b)) { return { ok: false, error: `Couldn't read "${seg}".` }; }

    let span: Span;
    if (a.verse !== null) {
      // "C:V" start
      const endCh: number = b && b.verse !== null ? b.chapter : a.chapter;
      const endV: number = b ? (b.verse !== null ? b.verse : b.chapter) : a.verse;
      span = { book, startChapter: a.chapter, startVerse: a.verse, endChapter: endCh, endVerse: endV };
      ctxChapter = endCh;
    } else if (ctxChapter !== null || single) {
      // bare numbers are verses (after a comma, or in a one-chapter book: "Jude 3-5")
      const ch: number = ctxChapter ?? 1;
      if (b && b.verse !== null) {
        span = { book, startChapter: ch, startVerse: a.chapter, endChapter: b.chapter, endVerse: b.verse };
        ctxChapter = b.chapter;
      } else {
        span = { book, startChapter: ch, startVerse: a.chapter, endChapter: ch, endVerse: b ? b.chapter : a.chapter };
      }
    } else if (b && b.verse !== null) {
      // "C-C2:V2" → from start of C to C2:V2
      span = { book, startChapter: a.chapter, startVerse: null, endChapter: b.chapter, endVerse: b.verse };
      ctxChapter = b.chapter;
    } else {
      // "C" or "C-C2" → whole chapters
      span = { book, startChapter: a.chapter, startVerse: null, endChapter: b ? b.chapter : a.chapter, endVerse: null };
      ctxChapter = null; // "Gen 1, 3" means chapters 1 and 3
    }

    const err = validateSpan(span);
    if (err) { return { ok: false, error: err }; }
    spans.push(span);
  }

  if (!spans.length) { return { ok: false, error: `Couldn't read "${input}".` }; }
  return { ok: true, spans };
}

function parsePoint(s: string): { chapter: number; verse: number | null } | null {
  const m = s.match(/^(\d{1,3})(?::(\d{1,3}))?$/);
  if (!m) { return null; }
  return { chapter: Number(m[1]), verse: m[2] !== undefined ? Number(m[2]) : null };
}

function validateSpan(s: Span): string | null {
  const { book } = s;
  for (const ch of [s.startChapter, s.endChapter]) {
    if (ch < 1 || ch > book.chapters) {
      return `${book.name} has ${book.chapters} chapter${book.chapters === 1 ? '' : 's'}.`;
    }
  }
  if (s.startVerse === 0 || s.endVerse === 0) { return 'Verse numbers start at 1.'; }
  const startKey = s.startChapter * 1000 + (s.startVerse ?? 0);
  const endKey = s.endChapter * 1000 + (s.endVerse ?? 999);
  if (endKey < startKey) { return 'The end of the range comes before the start.'; }
  return null;
}

/** Human label, e.g. "Genesis 1:1–5", "Romans 8:38–9:2", "Psalm 23", "John 3:16, 18–21". */
export function formatSpans(spans: Span[]): string {
  if (!spans.length) { return ''; }
  const book = spans[0].book;
  const name = displayName(book, spans);
  const parts: string[] = [];
  let lastChapter: number | null = null;

  for (const s of spans) {
    const single = book.chapters === 1;
    let piece: string;
    if (s.startVerse === null && s.endVerse === null) {
      piece = s.startChapter === s.endChapter ? `${s.startChapter}` : `${s.startChapter}–${s.endChapter}`;
      lastChapter = null;
    } else {
      const sv = s.startVerse ?? 1;
      const start = single ? `${sv}` : lastChapter === s.startChapter ? `${sv}` : `${s.startChapter}:${sv}`;
      let end = '';
      if (s.endChapter !== s.startChapter) {
        end = s.endVerse === null ? `${s.endChapter}` : `${s.endChapter}:${s.endVerse}`;
      } else if (s.endVerse !== null && s.endVerse !== sv) {
        end = `${s.endVerse}`;
      }
      piece = end ? `${start}–${end}` : start;
      lastChapter = s.endChapter;
    }
    parts.push(piece);
  }
  return `${name} ${parts.join(', ')}`;
}

function displayName(book: Book, spans: Span[]): string {
  // "Psalm 23" but "Psalms 1–2"
  if (book.id === 'PSA') {
    const oneChapter = spans.every(s => s.startChapter === spans[0].startChapter && s.endChapter === s.startChapter);
    return oneChapter ? 'Psalm' : 'Psalms';
  }
  return book.name;
}

export function bookByIndex(i: number): Book {
  return BOOKS[i];
}
