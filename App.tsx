import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { PluginManager } from 'sn-plugin-lib';
import { BOOKS, Book, findBook } from './src/books';
import { formatSpans, parseReference, Span } from './src/reference';
import { getChapter, hasOfflineText, resolveSpans, VerseRow } from './src/bibleSource';
import { buildText, getSettings, setSettings, Settings } from './src/format';
import { FRAME_TEST_DEFAULT, FrameTest, frameTestLabel } from './src/frameTest';
import { closePanel, insertPassage, pageSize } from './src/insert';
import { DEFAULT_PAGE, layoutTextBox, Size } from './src/layout';
import { MAX_VERSES, Selection, selectionRange, selectionStatus, tapVerse } from './src/selection';
import { Button, C, Choice, T, Toggle } from './src/ui/components';
import { ResumeKey, SafeScrollView } from './src/ui/SafeScrollView';

type Screen = 'books' | 'chapters' | 'verses' | 'preview';

// Host lifecycle states (see registerPluginLifeListener in the Supernote docs).
const LIFE_START = 2;
const LIFE_STOP = 3;

function App(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>('books');
  const [book, setBook] = useState<Book | null>(null);
  const [chapter, setChapter] = useState<number>(1);
  const [verses, setVerses] = useState<string[] | null>(null);
  const [sel, setSel] = useState<Selection>(null);

  const [previewSpans, setPreviewSpans] = useState<Span[]>([]);
  const [rows, setRows] = useState<VerseRow[]>([]);
  const [settings, setLocalSettings] = useState<Settings>(getSettings());
  const [page, setPage] = useState<Size | null>(null);
  // TEMPORARY frame experiment (src/frameTest.ts): null when off.
  const [frameTest, setFrameTest] = useState<FrameTest | null>(null);
  const testSlot = useRef(0);

  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeKey, setResumeKey] = useState(0);

  const inputRef = useRef<TextInput>(null);
  // Each load takes a ticket; a result that arrives after a newer load started is dropped.
  const ticket = useRef(0);

  const updateSettings = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setLocalSettings(next);
    setSettings(next);
  };

  const dismissKeyboard = () => {
    inputRef.current?.blur();
    Keyboard.dismiss();
  };

  // The host keeps this component mounted while the plugin is hidden, so clear any
  // keyboard/scroll state that went stale while we were away (see SafeScrollView).
  useEffect(() => {
    const sub = PluginManager.registerPluginLifeListener({
      onMsg: (msg: { state?: number } | undefined) => {
        if (msg?.state === LIFE_START || msg?.state === LIFE_STOP) {
          dismissKeyboard();
        }
        if (msg?.state === LIFE_START) {
          setResumeKey(k => k + 1);
        }
      },
    });
    return () => sub.remove();
  }, []);

  // ---- navigation -------------------------------------------------------

  /** Always lands on the verse list, with nothing selected. */
  const openChapter = useCallback(async (b: Book, ch: number) => {
    const id = ++ticket.current;
    setBook(b);
    setChapter(ch);
    setSel(null);
    setVerses(null);
    setError(null);
    setBusy(false);
    setScreen('verses');
    try {
      const v = await getChapter(b, ch);
      if (id === ticket.current) { setVerses(v); }
    } catch (e) {
      if (id === ticket.current) { setError((e as Error).message); }
    }
  }, []);

  const openBook = (b: Book) => {
    setBook(b);
    setError(null);
    if (b.chapters === 1) { openChapter(b, 1); }
    else { setScreen('chapters'); }
  };

  /** `pickerChapter` also loads that chapter's verse list, so Back from the preview lands on it. */
  const showPreview = useCallback(async (spans: Span[], pickerChapter?: { book: Book; chapter: number }) => {
    const id = ++ticket.current;
    setBusy(true);
    setError(null);
    try {
      const resolved = await resolveSpans(spans, MAX_VERSES);
      if (!resolved.length) { throw new Error('No verse text found for that reference.'); }
      const picker = pickerChapter ? await getChapter(pickerChapter.book, pickerChapter.chapter).catch(() => null) : undefined;
      if (id !== ticket.current) { return; }
      if (picker !== undefined) { setVerses(picker); }
      setPreviewSpans(spans);
      setRows(resolved);
      setScreen('preview');
    } catch (e) {
      if (id === ticket.current) { setError((e as Error).message); }
    } finally {
      if (id === ticket.current) { setBusy(false); }
    }
  }, []);

  const goFromQuery = async () => {
    dismissKeyboard();
    const q = query.trim();
    if (!q) { return; }
    // A bare book name ("John", "1 cor") jumps to its chapter list.
    if (!/\d\s*$/.test(q)) {
      const b = findBook(q);
      if (b && !Array.isArray(b)) {
        openBook(b);
        return;
      }
    }
    const parsed = parseReference(q);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    const first = parsed.spans[0];
    const oneChapter = parsed.spans.length === 1 && first.startChapter === first.endChapter;
    // A whole chapter ("Ps 23") opens its verse list to pick from, like tapping the chapter number.
    if (oneChapter && first.startVerse === null) {
      openChapter(first.book, first.startChapter);
      return;
    }
    // Sync the picker with the typed reference so Back lands on that chapter with it selected.
    setBook(first.book);
    setChapter(first.startChapter);
    setSel(oneChapter && first.startVerse !== null ? { anchor: first.startVerse, other: first.endVerse, clamped: false } : null);
    await showPreview(parsed.spans, { book: first.book, chapter: first.startChapter });
  };

  // ---- verse selection --------------------------------------------------

  const onTapVerse = useCallback((v: number) => setSel(s => tapVerse(s, v)), []);
  const range = selectionRange(sel);

  const lo = range?.lo ?? null;
  const hi = range?.hi ?? null;
  const selection: Span | null = useMemo(() => {
    if (!book || lo === null || hi === null) { return null; }
    return { book, startChapter: chapter, startVerse: lo, endChapter: chapter, endVerse: hi };
  }, [book, chapter, lo, hi]);

  // ---- insert -----------------------------------------------------------

  const label = useMemo(() => formatSpans(previewSpans), [previewSpans]);
  const output = useMemo(() => buildText(rows, label, settings), [rows, label, settings]);
  const overflow = useMemo(() => layoutTextBox(output, page ?? DEFAULT_PAGE, settings).overflow, [output, page, settings]);

  useEffect(() => {
    if (screen === 'preview' && !page) {
      pageSize().then(setPage);
    }
  }, [screen, page]);

  const doInsert = async () => {
    setBusy(true);
    setError(null);
    let inserted = false;
    try {
      const res = frameTest
        ? await insertPassage(`${frameTestLabel(frameTest)}\n${output}`, settings, { frame: frameTest, slot: testSlot.current++ })
        : await insertPassage(output, settings);
      if (res.ok) { inserted = true; }
      else { setError(res.error); }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
    if (inserted) {
      // Leave the picker on the same chapter for the next insertion.
      setSel(null);
      setScreen(book && verses ? 'verses' : 'books');
      closePanel();
    }
  };

  // ---- render -----------------------------------------------------------

  const back = () => {
    setError(null);
    if (screen === 'preview') { setScreen(book && verses ? 'verses' : 'books'); }
    else if (screen === 'verses') { setScreen(book && book.chapters > 1 ? 'chapters' : 'books'); }
    else if (screen === 'chapters') { setScreen('books'); }
  };

  return (
    <ResumeKey.Provider value={resumeKey}>
      <View style={st.root}>
        <StatusBar barStyle="dark-content" backgroundColor={C.paper} />

        {/* Top bar: close, title, free-text reference */}
        <View style={st.top}>
          <View style={st.titleRow}>
            <Text style={st.title}>Super Bible</Text>
            <Text style={st.subtitle}>Berean Standard Bible</Text>
            <View style={st.flex} />
            <Button label="Close" kind="quiet" onPress={closePanel} />
          </View>
          <View style={st.searchRow}>
            <TextInput
              ref={inputRef}
              style={st.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Type a reference, e.g. Genesis 1:1-5"
              placeholderTextColor={C.grey}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="go"
              onSubmitEditing={goFromQuery}
            />
            <Button label="Go" kind="primary" onPress={goFromQuery} style={st.goBtn} />
          </View>
        </View>

        {/* Breadcrumb */}
        <View style={st.crumbs}>
          {screen !== 'books' ? <Button label="‹ Back" kind="quiet" onPress={back} style={st.backBtn} /> : null}
          <Pressable onPress={() => setScreen('books')}>
            <Text style={[st.crumb, screen === 'books' && st.crumbHere]}>Books</Text>
          </Pressable>
          {book && screen !== 'books' && !(screen === 'preview' && !verses) ? (
            <>
              <Text style={st.crumbSep}>›</Text>
              <Pressable onPress={() => (book.chapters > 1 ? setScreen('chapters') : undefined)}>
                <Text style={[st.crumb, screen === 'chapters' && st.crumbHere]}>{book.name}</Text>
              </Pressable>
              {screen === 'verses' || screen === 'preview' ? (
                <>
                  <Text style={st.crumbSep}>›</Text>
                  <Pressable onPress={() => setScreen('verses')}>
                    <Text style={[st.crumb, screen === 'verses' && st.crumbHere]}>Chapter {chapter}</Text>
                  </Pressable>
                </>
              ) : null}
            </>
          ) : null}
        </View>

        {error ? (
          <View style={st.error}>
            <Text style={st.errorText}>{error}</Text>
          </View>
        ) : null}
        {busy ? <Text style={st.loading}>Loading…</Text> : null}

        {screen === 'books' ? <BooksScreen onPick={openBook} /> : null}
        {screen === 'chapters' && book ? <ChaptersScreen book={book} onPick={ch => openChapter(book, ch)} /> : null}
        {screen === 'verses' && book ? (
          <VersesScreen
            book={book}
            chapter={chapter}
            verses={verses}
            sel={sel}
            selection={selection}
            onTap={onTapVerse}
            onWhole={() => showPreview([{ book, startChapter: chapter, startVerse: null, endChapter: chapter, endVerse: null }])}
            onPrevNext={d => openChapter(book, chapter + d)}
            onPreview={() => selection && showPreview([selection])}
            onClear={() => setSel(null)}
          />
        ) : null}
        {screen === 'preview' ? (
          <PreviewScreen
            label={label}
            output={output}
            verseCount={rows.length}
            overflow={overflow}
            frameTest={frameTest}
            onFrameTest={t => {
              testSlot.current = 0;
              setFrameTest(t);
            }}
            settings={settings}
            onChange={updateSettings}
            onInsert={doInsert}
            busy={busy}
          />
        ) : null}
      </View>
    </ResumeKey.Provider>
  );
}

// ======================================================================
// Books
// ======================================================================

function BooksScreen({ onPick }: { onPick: (b: Book) => void }) {
  const ot = BOOKS.filter(b => b.testament === 'OT');
  const nt = BOOKS.filter(b => b.testament === 'NT');
  return (
    <SafeScrollView style={st.flex} contentContainerStyle={st.pad}>
      {!hasOfflineText() ? (
        <Text style={st.hint}>Offline text isn't bundled in this build, so chapters will download when opened.</Text>
      ) : null}
      <Text style={st.section}>Old Testament</Text>
      <View style={st.grid}>
        {ot.map(b => (
          <Cell key={b.id} label={b.short} onPress={() => onPick(b)} width="20%" />
        ))}
      </View>
      <Text style={st.section}>New Testament</Text>
      <View style={st.grid}>
        {nt.map(b => (
          <Cell key={b.id} label={b.short} onPress={() => onPick(b)} width="20%" />
        ))}
      </View>
    </SafeScrollView>
  );
}

// No adjustsFontSizeToFit: on Android it re-measures each cell repeatedly, which is slow
// with up to 150 cells, and every label here fits anyway.
function Cell({ label, onPress, width }: { label: string; onPress: () => void; width: `${number}%` }) {
  return (
    <View style={[st.cellWrap, { width }]}>
      <Pressable onPress={onPress} style={st.cell}>
        <Text style={st.cellText} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

// ======================================================================
// Chapters
// ======================================================================

function ChaptersScreen({ book, onPick }: { book: Book; onPick: (ch: number) => void }) {
  const nums = Array.from({ length: book.chapters }, (_, i) => i + 1);
  return (
    <SafeScrollView style={st.flex} contentContainerStyle={st.pad}>
      <Text style={st.heading}>{book.name}</Text>
      <Text style={st.hint}>Choose a chapter.</Text>
      <View style={st.grid}>
        {nums.map(n => (
          <Cell key={n} label={String(n)} onPress={() => onPick(n)} width="12.5%" />
        ))}
      </View>
    </SafeScrollView>
  );
}

// ======================================================================
// Verses
// ======================================================================

function VersesScreen(props: {
  book: Book;
  chapter: number;
  verses: string[] | null;
  sel: Selection;
  selection: Span | null;
  onTap: (v: number) => void;
  onWhole: () => void;
  onPrevNext: (delta: number) => void;
  onPreview: () => void;
  onClear: () => void;
}) {
  const { book, chapter, verses, sel, selection, onTap } = props;
  const range = selectionRange(sel);
  const heading = book.id === 'PSA' ? `Psalm ${chapter}` : `${book.name} ${chapter}`;
  const status = selectionStatus(sel, selection ? formatSpans([selection]) : '');
  const verseCount = verses ? verses.filter(Boolean).length : 0;
  const wholeTooLong = verseCount > MAX_VERSES;

  return (
    <View style={st.flex}>
      <View style={st.verseHeader}>
        <Text style={st.heading}>{heading}</Text>
        <View style={st.flex} />
        <Button label="‹" onPress={() => props.onPrevNext(-1)} disabled={chapter <= 1} style={st.navBtn} />
        <Button label="›" onPress={() => props.onPrevNext(1)} disabled={chapter >= book.chapters} style={st.navBtn} />
        <Button label={wholeTooLong ? `Whole chapter (over ${MAX_VERSES})` : 'Whole chapter'} onPress={props.onWhole} disabled={!verses || wholeTooLong} />
      </View>

      {!verses ? (
        <Text style={st.loading}>Loading {heading}…</Text>
      ) : (
        // Keyed by chapter so each chapter starts at the top.
        <SafeScrollView key={`${book.id}.${chapter}`} style={st.flex} contentContainerStyle={st.padList}>
          {verses.map((text, i) => {
            const v = i + 1;
            const on = range !== null && v >= range.lo && v <= range.hi;
            const edge = range !== null && (v === range.lo || v === range.hi);
            return <VerseItem key={v} v={v} text={text} on={on} edge={edge} onTap={onTap} />;
          })}
        </SafeScrollView>
      )}

      <View style={st.bottomBar}>
        <Text style={st.status} numberOfLines={2}>
          {status}
        </Text>
        {sel ? <Button label="Clear" onPress={props.onClear} style={st.barBtn} /> : null}
        <Button label="Preview" kind="primary" onPress={props.onPreview} disabled={!selection} style={st.barBtn} />
      </View>
    </View>
  );
}

// Memoised so a tap re-renders only the rows whose highlight changed, not the whole chapter.
const VerseItem = memo(function VerseItem({ v, text, on, edge, onTap }: { v: number; text: string; on: boolean; edge: boolean; onTap: (v: number) => void }) {
  if (!text) {
    return (
      <View style={st.verseRow}>
        <Text style={st.verseNum}>{v}</Text>
        <Text style={[st.verseText, st.omitted]}>Not in the BSB text (later manuscripts).</Text>
      </View>
    );
  }
  return (
    <Pressable onPress={() => onTap(v)} style={[st.verseRow, on && st.verseOn, edge && st.verseEdge]}>
      <Text style={[st.verseNum, on && st.verseNumOn]}>{v}</Text>
      <Text style={st.verseText} numberOfLines={on ? undefined : 2}>
        {text}
      </Text>
    </Pressable>
  );
});

// ======================================================================
// Preview + options
// ======================================================================

function PreviewScreen(props: {
  label: string;
  output: string;
  verseCount: number;
  overflow: boolean;
  frameTest: FrameTest | null;
  onFrameTest: (t: FrameTest | null) => void;
  settings: Settings;
  onChange: (p: Partial<Settings>) => void;
  onInsert: () => void;
  busy: boolean;
}) {
  const { settings: s, onChange } = props;
  return (
    <View style={st.flex}>
      <SafeScrollView style={st.flex} contentContainerStyle={st.pad}>
        <Text style={st.heading}>{props.label}</Text>
        <Text style={st.hint}>
          {props.verseCount} verse{props.verseCount === 1 ? '' : 's'} · this is exactly what will go into your note
        </Text>

        <View style={st.paper}>
          <Text style={[st.scripture, s.bold && st.bold]}>{props.output}</Text>
        </View>
        {props.overflow ? (
          <Text style={st.warn}>
            {s.textSize === 'small'
              ? 'This is too long to fit on one page. Choose fewer verses.'
              : 'This is too long to fit on one page at this size. Try Small, or fewer verses.'}
          </Text>
        ) : null}

        <Choice
          label="Verse numbers"
          value={s.verseNumbers}
          onChange={v => onChange({ verseNumbers: v })}
          options={[
            ['plain', '1 Plain'],
            ['superscript', '¹ Superscript'],
            ['off', 'None'],
          ]}
        />
        <Choice
          label="Layout"
          value={s.layout}
          onChange={v => onChange({ layout: v })}
          options={[
            ['paragraph', 'Paragraph'],
            ['lines', 'One per line'],
            ['spaced', 'Spaced list'],
          ]}
        />
        <Choice
          label="Reference"
          value={s.reference}
          onChange={v => onChange({ reference: v })}
          options={[
            ['top', 'Above'],
            ['bottom', 'Below'],
            ['off', 'None'],
          ]}
        />
        <Choice
          label="Text size"
          value={s.textSize}
          onChange={v => onChange({ textSize: v })}
          options={[
            ['small', 'Small'],
            ['medium', 'Medium'],
            ['large', 'Large'],
          ]}
        />
        <Choice
          label="Place on page"
          value={s.placement}
          onChange={v => onChange({ placement: v })}
          options={[
            ['top', 'Near the top'],
            ['middle', 'Centred'],
          ]}
        />
        <View style={st.toggles}>
          <Toggle label="Add (BSB)" value={s.includeTranslation} onChange={v => onChange({ includeTranslation: v })} />
          <Toggle label="Bold" value={s.bold} onChange={v => onChange({ bold: v })} />
          <Toggle label="Border" value={s.border} onChange={v => onChange({ border: v })} />
        </View>
        <Text style={st.hint}>
          After inserting, lasso the text box to move or resize it. Text boxes go on the main layer.
        </Text>
        <FrameTestPanel value={props.frameTest} onChange={props.onFrameTest} />
      </SafeScrollView>

      <View style={st.bottomBar}>
        <View style={st.flex} />
        <Button label={props.busy ? 'Inserting…' : 'Insert into note'} kind="primary" onPress={props.onInsert} disabled={props.busy} style={st.insertBtn} />
      </View>
    </View>
  );
}

// TEMPORARY: see src/frameTest.ts. Each test insert is labelled and placed below the last.
function FrameTestPanel({ value: t, onChange }: { value: FrameTest | null; onChange: (t: FrameTest | null) => void }) {
  return (
    <View>
      <Text style={st.section}>Frame test (temporary)</Text>
      <Toggle label="Use frame test for inserts" value={t !== null} onChange={on => onChange(on ? FRAME_TEST_DEFAULT : null)} />
      {t ? (
        <>
          <Choice
            label="Frame mode (textFrameStyle)"
            value={t.mode}
            onChange={mode => onChange({ ...t, mode })}
            options={[
              ['0', '0'],
              ['1', '1'],
              ['2', '2'],
              ['3', '3'],
            ]}
          />
          <Choice
            label="Fill colour (0 black … 255 white)"
            value={t.fill}
            onChange={fill => onChange({ ...t, fill })}
            options={[
              ['none', 'None'],
              ['255', '255'],
              ['200', '200'],
              ['128', '128'],
              ['0', '0'],
            ]}
          />
          <Choice
            label="Text colour"
            value={t.text}
            onChange={text => onChange({ ...t, text })}
            options={[
              ['default', 'Default'],
              ['white255', 'White 255'],
              ['whiteArgb', 'White ARGB'],
            ]}
          />
          <Text style={st.hint}>Each insert starts with a line naming these settings and goes below the previous one.</Text>
        </>
      ) : null}
    </View>
  );
}

// ======================================================================

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  flex: { flex: 1 },
  pad: { padding: 24, paddingBottom: 40 },
  padList: { paddingHorizontal: 16, paddingBottom: 24 },

  top: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: C.ink },
  titleRow: { flexDirection: 'row', alignItems: 'baseline' },
  title: { fontFamily: T.serif, fontSize: T.title, color: C.ink, fontWeight: '700' },
  subtitle: { fontSize: T.small, color: C.grey, marginLeft: 14 },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  input: {
    flex: 1,
    minHeight: 64,
    borderWidth: 2,
    borderColor: C.ink,
    borderRadius: 6,
    paddingHorizontal: 16,
    fontSize: T.body,
    color: C.ink,
  },
  goBtn: { marginLeft: 12, minWidth: 96 },

  crumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 64,
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
  },
  backBtn: { minHeight: 52, paddingHorizontal: 10, marginRight: 8 },
  crumb: { fontSize: T.label, color: C.grey, paddingVertical: 12, paddingHorizontal: 4 },
  crumbHere: { color: C.ink, fontWeight: '700' },
  crumbSep: { fontSize: T.label, color: C.grey, marginHorizontal: 6 },

  error: { margin: 16, marginBottom: 0, padding: 16, borderWidth: 2, borderColor: C.ink, borderStyle: 'dashed' },
  errorText: { fontSize: T.small, color: C.ink },
  loading: { fontSize: T.small, color: C.grey, marginTop: 16, marginHorizontal: 24 },

  section: { fontFamily: T.serif, fontSize: 24, color: C.ink, marginTop: 8, marginBottom: 8, fontStyle: 'italic' },
  heading: { fontFamily: T.serif, fontSize: 28, color: C.ink, fontWeight: '700' },
  hint: { fontSize: T.small, color: C.grey, marginTop: 6, marginBottom: 14 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5, marginBottom: 18 },
  cellWrap: { padding: 5 },
  cell: {
    minHeight: 64,
    borderWidth: 2,
    borderColor: C.ink,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cellText: { fontSize: T.label, color: C.ink },

  verseHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12 },
  navBtn: { minWidth: 64, marginRight: 10 },
  verseRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
    borderLeftWidth: 6,
    borderLeftColor: C.paper,
  },
  verseOn: { backgroundColor: C.fill, borderLeftColor: C.grey },
  verseEdge: { borderLeftColor: C.ink },
  verseNum: { width: 52, fontSize: T.body, color: C.grey, fontWeight: '600' },
  verseNumOn: { color: C.ink, fontWeight: '800' },
  verseText: { flex: 1, fontFamily: T.serif, fontSize: T.body, lineHeight: 32, color: C.ink },
  omitted: { color: C.grey, fontStyle: 'italic' },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 2,
    borderTopColor: C.ink,
    backgroundColor: C.paper,
  },
  status: { flex: 1, fontSize: T.small, color: C.ink, marginRight: 12 },
  barBtn: { marginLeft: 10 },
  insertBtn: { minWidth: 260 },

  paper: { borderWidth: 1, borderColor: C.rule, padding: 20, marginBottom: 24, marginTop: 4 },
  warn: { fontSize: T.small, color: C.ink, fontWeight: '700', marginTop: -12, marginBottom: 20 },
  scripture: { fontFamily: T.serif, fontSize: T.body, lineHeight: 34, color: C.ink },
  bold: { fontWeight: '700' },
  toggles: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
});

export default App;
