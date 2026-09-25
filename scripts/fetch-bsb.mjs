#!/usr/bin/env node
/**
 * Downloads the Berean Standard Bible (public domain) verse-by-verse text from
 * https://bereanbible.com/bsb.txt and converts it to src/data/bsb.json, which
 * is bundled into the plugin so it works fully offline on the Supernote.
 *
 *   node scripts/fetch-bsb.mjs                 # download
 *   node scripts/fetch-bsb.mjs --file bsb.txt  # use a copy you already have
 *
 * bsb.txt format: a few header lines, then one verse per line:
 *   Genesis 1:1<TAB>In the beginning God created the heavens and the earth.
 *
 * Output: { source, books: string[66][chapter][verse] } (verse 1 at index 0).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const URL_BSB = 'https://bereanbible.com/bsb.txt';
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'src', 'data', 'bsb.json');

// Expected chapter counts in canonical order, used to validate the parse.
const CHAPTERS = [
  50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150, 31, 12, 8, 66, 52, 5, 48,
  12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4, 28, 16, 24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3,
  1, 13, 5, 5, 3, 5, 1, 1, 1, 22,
];

async function load() {
  const i = process.argv.indexOf('--file');
  if (i !== -1 && process.argv[i + 1]) {
    console.log(`Reading ${process.argv[i + 1]}`);
    return readFile(process.argv[i + 1], 'utf8');
  }
  console.log(`Downloading ${URL_BSB} …`);
  const res = await fetch(URL_BSB);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${URL_BSB}`);
  return res.text();
}

const raw = (await load()).replace(/^\uFEFF/, '');
const LINE = /^(.+?)\s+(\d+):(\d+)\t(.*)$/;

const books = [];
const names = [];
let current = null;
let count = 0;

for (const line of raw.split(/\r?\n/)) {
  const m = line.match(LINE);
  if (!m) continue;
  const [, name, c, v, text] = m;
  if (name !== current) {
    current = name;
    names.push(name);
    books.push([]);
  }
  const book = books[books.length - 1];
  const ch = Number(c) - 1;
  const vs = Number(v) - 1;
  book[ch] ??= [];
  book[ch][vs] = text.trim();
  count++;
}

// Fill any gaps (verses absent from the file) with "" so indices stay aligned.
for (const book of books) {
  for (let c = 0; c < book.length; c++) {
    book[c] ??= [];
    for (let v = 0; v < book[c].length; v++) book[c][v] ??= '';
  }
}

if (books.length !== 66) {
  throw new Error(`Expected 66 books, found ${books.length}: ${names.join(', ')}`);
}
books.forEach((b, i) => {
  if (b.length !== CHAPTERS[i]) throw new Error(`${names[i]}: expected ${CHAPTERS[i]} chapters, found ${b.length}`);
});

const out = { source: `Berean Standard Bible (public domain), ${URL_BSB}, fetched ${new Date().toISOString().slice(0, 10)}`, books };
await writeFile(OUT, JSON.stringify(out));
const empty = books.flat(2).filter(t => !t).length;
console.log(`Wrote ${OUT}: 66 books, ${count} verses${empty ? ` (${empty} empty/omitted)` : ''}.`);
