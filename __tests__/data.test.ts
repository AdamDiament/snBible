import { BOOKS } from '../src/books';

// The bundled text must line up with books.ts, since getChapter indexes it by book.index.
describe('bundled BSB data', () => {
  const data = require('../src/data/bsb.json') as { books: string[][][] };

  test('has every book and chapter from books.ts', () => {
    expect(data.books).toHaveLength(BOOKS.length);
    BOOKS.forEach(b => expect([b.name, data.books[b.index].length]).toEqual([b.name, b.chapters]));
  });

  test('spot checks', () => {
    expect(data.books[0][0][0]).toBe('In the beginning God created the heavens and the earth.');
    expect(data.books[18][22]).toHaveLength(6); // Psalm 23
    expect(data.books[18][118]).toHaveLength(176); // Psalm 119
    expect(data.books[39][16][20]).toBe(''); // Matthew 17:21, omitted by the BSB
  });
});
