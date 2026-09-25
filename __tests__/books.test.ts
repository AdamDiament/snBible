import { BOOKS, Book, findBook, normaliseBookKey } from '../src/books';

describe('books', () => {
  test('66 books, 39 OT then 27 NT, 1189 chapters', () => {
    expect(BOOKS).toHaveLength(66);
    expect(BOOKS.filter(b => b.testament === 'OT')).toHaveLength(39);
    expect(BOOKS[39].name).toBe('Matthew');
    expect(BOOKS.reduce((n, b) => n + b.chapters, 0)).toBe(1189);
    BOOKS.forEach((b, i) => expect(b.index).toBe(i));
  });

  test('no lookup key maps to two books', () => {
    const owner = new Map<string, Book>();
    const clashes: string[] = [];
    for (const b of BOOKS) {
      const keys = new Set([normaliseBookKey(b.name), b.id.toLowerCase(), normaliseBookKey(b.short), ...b.aliases]);
      for (const k of keys) {
        const prev = owner.get(k);
        if (prev && prev !== b) {
          clashes.push(`${k}: ${prev.name} / ${b.name}`);
        }
        owner.set(k, b);
      }
    }
    expect(clashes).toEqual([]);
  });

  test('aliases are already normalised', () => {
    for (const b of BOOKS) {
      for (const a of b.aliases) {
        expect(normaliseBookKey(a)).toBe(a);
      }
    }
  });

  test('every name, id, short label and alias finds its own book', () => {
    for (const b of BOOKS) {
      for (const k of [b.name, b.id, b.short, ...b.aliases]) {
        expect([k, findBook(k)]).toEqual([k, b]);
      }
    }
  });

  test('normaliseBookKey handles ordinals and roman numerals', () => {
    expect(normaliseBookKey('First John')).toBe('1john');
    expect(normaliseBookKey('2nd Kings')).toBe('2kings');
    expect(normaliseBookKey('III John')).toBe('3john');
    expect(normaliseBookKey('ii cor.')).toBe('2cor');
    expect(normaliseBookKey('I  Sam.')).toBe('1sam');
    expect(normaliseBookKey('Isaiah')).toBe('isaiah');
  });

  test('findBook: prefixes and ambiguity', () => {
    expect((findBook('deuter') as Book).id).toBe('DEU');
    expect((findBook('lament') as Book).id).toBe('LAM');
    expect(findBook('zzz')).toBeNull();
    expect(findBook('')).toBeNull();
    const jo = findBook('jo');
    expect(Array.isArray(jo)).toBe(true);
    expect((jo as Book[]).map(b => b.id).sort()).toEqual(['JHN', 'JOB', 'JOL', 'JON', 'JOS']);
  });
});
