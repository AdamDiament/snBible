import type { VerseRow } from './bibleSource';

export type Settings = {
  verseNumbers: 'plain' | 'superscript' | 'off';
  layout: 'paragraph' | 'lines';
  reference: 'top' | 'bottom' | 'off';
  includeTranslation: boolean; // append "(BSB)" to the reference
  textSize: 'small' | 'medium' | 'large';
  bold: boolean;
  border: boolean;
  placement: 'top' | 'middle';
};

export const DEFAULT_SETTINGS: Settings = {
  verseNumbers: 'plain',
  layout: 'paragraph',
  reference: 'top',
  includeTranslation: true,
  textSize: 'medium',
  bold: false,
  border: false,
  placement: 'top',
};

// Settings survive for as long as the plugin process lives (between openings of the panel).
let current: Settings = { ...DEFAULT_SETTINGS };
export const getSettings = () => current;
export const setSettings = (s: Settings) => {
  current = s;
};

const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};
const sup = (s: string) => s.split('').map(c => SUP[c] ?? c).join('');

function marker(row: VerseRow, showChapter: boolean, style: Settings['verseNumbers']): string {
  if (style === 'off') { return ''; }
  const n = showChapter ? `${row.chapter}:${row.verse}` : `${row.verse}`;
  return style === 'superscript' ? sup(n) : `${n} `;
}

/** Build the exact string that will go into the Supernote text box. */
export function buildText(rows: VerseRow[], label: string, s: Settings): string {
  const multiChapter = rows.length > 0 && rows.some(r => r.chapter !== rows[0].chapter);
  let lastChapter: number | null = null;

  const pieces = rows.map(r => {
    // Show "chapter:verse" on the first verse of each new chapter in a multi-chapter selection.
    const showChapter = multiChapter && r.chapter !== lastChapter;
    lastChapter = r.chapter;
    return marker(r, showChapter, s.verseNumbers) + r.text;
  });

  const body = s.layout === 'lines' ? pieces.join('\n') : pieces.join(' ');
  const ref = s.includeTranslation ? `${label} (BSB)` : label;

  if (s.reference === 'top') { return `${ref}\n${body}`; }
  if (s.reference === 'bottom') { return `${body}\n— ${ref}`; }
  return body;
}
