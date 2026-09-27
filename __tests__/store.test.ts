import { DEFAULT_SETTINGS, Settings } from '../src/format';
import { formatSpans, parseReference } from '../src/reference';
import { decodeState, encodeState, pushRecent, RECENT_MAX } from '../src/store';

jest.mock('sn-plugin-lib', () => ({ FileUtils: {}, PluginManager: {} }));

const custom: Settings = {
  verseNumbers: 'superscript',
  layout: 'spaced',
  reference: 'bottom',
  includeTranslation: false,
  textSize: 'large',
  bold: true,
  placement: 'middle',
};

describe('store encoding', () => {
  test('settings and recents round-trip through directory names', () => {
    const recents = ['John 3:16–18', 'Psalm 23', 'Romans 8:38–9:2', 'John 3:16, 18–21'];
    const names = encodeState({ settings: custom, recents });
    expect(names).toContain('s.layout=spaced');
    expect(names).toContain('s.bold=true');
    // Every name must be a single, legal path segment.
    for (const n of names) {
      expect(n).not.toMatch(/[/\0]/);
      expect(n.length).toBeLessThan(255);
    }
    expect(decodeState(names)).toEqual({ settings: custom, recents });
  });

  test('unknown keys and values fall back to defaults', () => {
    const st = decodeState(['s.layout=zigzag', 's.colour=red', 's.textSize=small', 'junk', 'r.x=John', 'r.0=%E0%A4%A']);
    expect(st.settings).toEqual({ ...DEFAULT_SETTINGS, textSize: 'small' });
    expect(st.recents).toEqual([]);
  });

  test('recents come back in order, however the directory lists them', () => {
    const names = encodeState({ settings: DEFAULT_SETTINGS, recents: ['A 1', 'B 2', 'C 3'] }).reverse();
    expect(decodeState(names).recents).toEqual(['A 1', 'B 2', 'C 3']);
  });

  test('pushRecent puts the newest first, removes duplicates and caps the list', () => {
    expect(pushRecent(['Psalm 23', 'John 3:16'], 'John 3:16')).toEqual(['John 3:16', 'Psalm 23']);
    const many = Array.from({ length: 10 }, (_, i) => `Genesis ${i + 1}`);
    expect(pushRecent(many, 'Jude 3')).toHaveLength(RECENT_MAX);
  });

  test.each(['John 3:16-18', 'Ps 23', 'Rom 8:38-9:2', 'John 3:16, 18-21', 'Jude 3-5', 'Philemon 6', 'Gen 1-2', '1 Cor 13:4-7'])(
    'recent label for %s parses back to the same passage',
    ref => {
      const first = parseReference(ref);
      if (!first.ok) {
        throw new Error(first.error);
      }
      const again = parseReference(formatSpans(first.spans));
      expect(again).toEqual(first);
    },
  );
});
