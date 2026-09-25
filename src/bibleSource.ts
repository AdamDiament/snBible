import { PluginManager } from 'sn-plugin-lib';
import { BOOKS, Book } from './books';
import type { Span } from './reference';

/**
 * Where verse text comes from.
 *
 * 1. OFFLINE (preferred): src/data/bsb.json, generated from
 *    https://bereanbible.com/bsb.txt by `npm run fetch-bsb` and bundled into
 *    the plugin. Works with Wi-Fi off.
 * 2. ONLINE fallback: if the bundle is missing a book (e.g. you skipped the
 *    fetch step), chapters are downloaded on demand from the Free Use Bible
 *    API (bible.helloao.org, BSB) and cached for the session.
 */

type BundledData = { source?: string; books: string[][][] };

let bundled: BundledData | null | undefined;

function getBundled(): BundledData | null {
  if (bundled === undefined) {
    try {
      // Lazy require so the ~4 MB JSON is only evaluated the first time it's needed.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const data = require('./data/bsb.json') as BundledData;
      bundled = data && Array.isArray(data.books) && data.books.length === 66 ? data : null;
    } catch {
      bundled = null;
    }
  }
  return bundled;
}

export function hasOfflineText(): boolean {
  return getBundled() !== null;
}

const onlineCache = new Map<string, string[]>();

/** Returns the chapter's verses; index 0 is verse 1. Empty strings mark verses the BSB omits. */
export async function getChapter(book: Book, chapter: number): Promise<string[]> {
  const data = getBundled();
  if (data) {
    const ch = data.books[book.index]?.[chapter - 1];
    if (ch) return ch;
  }
  return fetchChapterOnline(book, chapter);
}

export async function getVerseCount(book: Book, chapter: number): Promise<number> {
  return (await getChapter(book, chapter)).length;
}

let internetGranted = false;

async function ensureInternet(): Promise<void> {
  if (internetGranted) return;
  const perm = 'plugin.permission.INTERNET';
  const status = await PluginManager.hasPermission(perm);
  if (status === 1) {
    internetGranted = true;
    return;
  }
  const res = await PluginManager.requestPermission(
    perm,
    'snBible needs internet access to download Bible text, because the offline text was not bundled.',
  );
  if (res !== 1 && res !== 2) {
    throw new Error('Internet access was not allowed. Rebuild the plugin with the offline text (npm run fetch-bsb), or allow internet access.');
  }
  internetGranted = true;
}

type ApiVerseContent = string | { text?: string; lineBreak?: boolean; noteId?: number; heading?: string };
type ApiChapter = {
  chapter: { content: Array<{ type: string; number?: number; content?: ApiVerseContent[] }> };
};

async function fetchChapterOnline(book: Book, chapter: number): Promise<string[]> {
  const key = `${book.id}.${chapter}`;
  const cached = onlineCache.get(key);
  if (cached) return cached;

  await ensureInternet();
  const url = `https://bible.helloao.org/api/BSB/${book.id}/${chapter}.json`;
  let json: ApiChapter;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    json = (await res.json()) as ApiChapter;
  } catch (e) {
    throw new Error(`Couldn't download ${book.name} ${chapter}. Check the Wi-Fi connection. (${String((e as Error)?.message ?? e)})`);
  }

  const verses: string[] = [];
  for (const block of json.chapter.content) {
    if (block.type !== 'verse' || !block.number) continue;
    const pieces: string[] = [];
    for (const c of block.content ?? []) {
      if (typeof c === 'string') pieces.push(c);
      else if (c && typeof c.text === 'string') pieces.push(c.text);
      // noteId (footnote markers) and lineBreak are dropped
    }
    const prev = verses[block.number - 1];
    const text = tidy(pieces.join(' '));
    verses[block.number - 1] = prev ? `${prev} ${text}` : text;
  }
  for (let i = 0; i < verses.length; i++) if (verses[i] === undefined) verses[i] = '';

  onlineCache.set(key, verses);
  return verses;
}

function tidy(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/\s+([,.;:!?’”)])/g, '$1').trim();
}

export type VerseRow = { chapter: number; verse: number; text: string };

/** Expand parsed spans to concrete verses, clamped to what exists. */
export async function resolveSpans(spans: Span[]): Promise<VerseRow[]> {
  const out: VerseRow[] = [];
  const seen = new Set<string>();
  for (const s of spans) {
    for (let ch = s.startChapter; ch <= s.endChapter; ch++) {
      const verses = await getChapter(s.book, ch);
      const from = ch === s.startChapter && s.startVerse !== null ? s.startVerse : 1;
      const to = ch === s.endChapter && s.endVerse !== null ? Math.min(s.endVerse, verses.length) : verses.length;
      if (from > verses.length) {
        throw new Error(`${s.book.name} ${ch} has only ${verses.length} verses.`);
      }
      for (let v = from; v <= to; v++) {
        const key = `${ch}:${v}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const text = verses[v - 1];
        if (text) out.push({ chapter: ch, verse: v, text });
      }
    }
  }
  return out;
}

export { BOOKS };
