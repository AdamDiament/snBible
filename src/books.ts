/**
 * Canonical 66-book Protestant canon, in BSB / English versification.
 *
 * `id`       – USFM code (used by the bible.helloao.org online fallback)
 * `name`     – display name
 * `short`    – compact label for the book grid on small e-ink screens
 * `chapters` – chapter count
 * `aliases`  – extra lookup keys for the free-text parser (normalised:
 *              lowercase, no spaces, no dots). The normalised full name and
 *              `id` are added automatically.
 */
export type Book = {
  index: number;
  id: string;
  name: string;
  short: string;
  chapters: number;
  testament: 'OT' | 'NT';
  aliases: string[];
};

type Row = [id: string, name: string, short: string, chapters: number, aliases: string[]];

const ROWS: Row[] = [
  ['GEN', 'Genesis', 'Gen', 50, ['ge', 'gn']],
  ['EXO', 'Exodus', 'Exod', 40, ['ex', 'exod']],
  ['LEV', 'Leviticus', 'Lev', 27, ['le', 'lv']],
  ['NUM', 'Numbers', 'Num', 36, ['nu', 'nm', 'nb']],
  ['DEU', 'Deuteronomy', 'Deut', 34, ['de', 'dt', 'deut']],
  ['JOS', 'Joshua', 'Josh', 24, ['josh', 'jsh']],
  ['JDG', 'Judges', 'Judg', 21, ['judg', 'jg', 'jdgs']],
  ['RUT', 'Ruth', 'Ruth', 4, ['ru', 'rth']],
  ['1SA', '1 Samuel', '1 Sam', 31, ['1sam', '1sm', '1s']],
  ['2SA', '2 Samuel', '2 Sam', 24, ['2sam', '2sm', '2s']],
  ['1KI', '1 Kings', '1 Kgs', 22, ['1kgs', '1kg', '1k']],
  ['2KI', '2 Kings', '2 Kgs', 25, ['2kgs', '2kg', '2k']],
  ['1CH', '1 Chronicles', '1 Chr', 29, ['1chr', '1chron']],
  ['2CH', '2 Chronicles', '2 Chr', 36, ['2chr', '2chron']],
  ['EZR', 'Ezra', 'Ezra', 10, []],
  ['NEH', 'Nehemiah', 'Neh', 13, ['ne']],
  ['EST', 'Esther', 'Esth', 10, ['esth', 'es']],
  ['JOB', 'Job', 'Job', 42, ['jb']],
  ['PSA', 'Psalms', 'Ps', 150, ['ps', 'psalm', 'pss', 'psm', 'pslm']],
  ['PRO', 'Proverbs', 'Prov', 31, ['prov', 'pr', 'prv']],
  ['ECC', 'Ecclesiastes', 'Eccl', 12, ['eccl', 'eccles', 'ec', 'qoh', 'qoheleth']],
  ['SNG', 'Song of Solomon', 'Song', 8, ['song', 'songofsongs', 'sos', 'so', 'canticles', 'cant']],
  ['ISA', 'Isaiah', 'Isa', 66, ['is']],
  ['JER', 'Jeremiah', 'Jer', 52, ['je', 'jr']],
  ['LAM', 'Lamentations', 'Lam', 5, ['la']],
  ['EZK', 'Ezekiel', 'Ezek', 48, ['ezek', 'eze']],
  ['DAN', 'Daniel', 'Dan', 12, ['da', 'dn']],
  ['HOS', 'Hosea', 'Hos', 14, ['ho']],
  ['JOL', 'Joel', 'Joel', 3, ['jl']],
  ['AMO', 'Amos', 'Amos', 9, ['am']],
  ['OBA', 'Obadiah', 'Obad', 1, ['obad', 'ob']],
  ['JON', 'Jonah', 'Jonah', 4, ['jnh']],
  ['MIC', 'Micah', 'Mic', 7, ['mc']],
  ['NAM', 'Nahum', 'Nah', 3, ['nah', 'na']],
  ['HAB', 'Habakkuk', 'Hab', 3, ['hb']],
  ['ZEP', 'Zephaniah', 'Zeph', 3, ['zeph', 'zp']],
  ['HAG', 'Haggai', 'Hag', 2, ['hg']],
  ['ZEC', 'Zechariah', 'Zech', 14, ['zech', 'zc']],
  ['MAL', 'Malachi', 'Mal', 4, ['ml']],
  ['MAT', 'Matthew', 'Matt', 28, ['matt', 'mt']],
  ['MRK', 'Mark', 'Mark', 16, ['mk', 'mr']],
  ['LUK', 'Luke', 'Luke', 24, ['lk']],
  ['JHN', 'John', 'John', 21, ['jn', 'joh']],
  ['ACT', 'Acts', 'Acts', 28, ['ac']],
  ['ROM', 'Romans', 'Rom', 16, ['ro', 'rm']],
  ['1CO', '1 Corinthians', '1 Cor', 16, ['1cor']],
  ['2CO', '2 Corinthians', '2 Cor', 13, ['2cor']],
  ['GAL', 'Galatians', 'Gal', 6, ['ga']],
  ['EPH', 'Ephesians', 'Eph', 6, ['ephes']],
  ['PHP', 'Philippians', 'Phil', 4, ['phil', 'pp']],
  ['COL', 'Colossians', 'Col', 4, []],
  ['1TH', '1 Thessalonians', '1 Thess', 5, ['1thess', '1thes']],
  ['2TH', '2 Thessalonians', '2 Thess', 3, ['2thess', '2thes']],
  ['1TI', '1 Timothy', '1 Tim', 6, ['1tim']],
  ['2TI', '2 Timothy', '2 Tim', 4, ['2tim']],
  ['TIT', 'Titus', 'Titus', 3, []],
  ['PHM', 'Philemon', 'Phlm', 1, ['philem', 'phlm', 'phmn']],
  ['HEB', 'Hebrews', 'Heb', 13, []],
  ['JAS', 'James', 'Jas', 5, ['jm', 'jms']],
  ['1PE', '1 Peter', '1 Pet', 5, ['1pet', '1pt', '1p']],
  ['2PE', '2 Peter', '2 Pet', 3, ['2pet', '2pt', '2p']],
  ['1JN', '1 John', '1 John', 5, ['1jhn', '1jo', '1j']],
  ['2JN', '2 John', '2 John', 1, ['2jhn', '2jo', '2j']],
  ['3JN', '3 John', '3 John', 1, ['3jhn', '3jo', '3j']],
  ['JUD', 'Jude', 'Jude', 1, ['jud', 'jd']],
  ['REV', 'Revelation', 'Rev', 22, ['re', 'rv', 'revelations', 'apocalypse', 'apoc']],
];

export const BOOKS: Book[] = ROWS.map(([id, name, short, chapters, aliases], index) => ({
  index,
  id,
  name,
  short,
  chapters,
  testament: index < 39 ? 'OT' : 'NT',
  aliases,
}));

/** Lowercase, strip spaces/dots, turn leading "first/second/third" or roman numerals into digits. */
export function normaliseBookKey(raw: string): string {
  let s = raw.toLowerCase().trim().replace(/\./g, ' ').replace(/\s+/g, ' ');
  s = s
    .replace(/^(first|1st)\s+/, '1 ')
    .replace(/^(second|2nd)\s+/, '2 ')
    .replace(/^(third|3rd)\s+/, '3 ')
    .replace(/^iii\s+/, '3 ')
    .replace(/^ii\s+/, '2 ')
    .replace(/^i\s+/, '1 ');
  return s.replace(/\s/g, '');
}

const EXACT = new Map<string, Book>();
for (const b of BOOKS) {
  EXACT.set(normaliseBookKey(b.name), b);
  EXACT.set(b.id.toLowerCase(), b);
  EXACT.set(normaliseBookKey(b.short), b);
  for (const a of b.aliases) { EXACT.set(a, b); }
}

/**
 * Find a book from free text: exact alias first, then an unambiguous prefix
 * of a full book name ("deuter", "lament", "philip").
 * Returns `null` if nothing matches, or a list of candidates when ambiguous.
 */
export function findBook(raw: string): Book | Book[] | null {
  const key = normaliseBookKey(raw);
  if (!key) { return null; }
  const exact = EXACT.get(key);
  if (exact) { return exact; }
  const hits = BOOKS.filter(b => normaliseBookKey(b.name).startsWith(key));
  if (hits.length === 1) { return hits[0]; }
  if (hits.length > 1) { return hits; }
  return null;
}
