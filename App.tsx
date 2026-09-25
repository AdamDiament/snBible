import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BOOKS, Book, findBook } from './src/books';
import { formatSpans, parseReference, Span } from './src/reference';
import { getChapter, hasOfflineText, resolveSpans, VerseRow } from './src/bibleSource';
import { buildText, getSettings, setSettings, Settings } from './src/format';
import { closePanel, insertPassage } from './src/insert';
import { Button, C, Choice, T, Toggle } from './src/ui/components';

type Screen = 'books' | 'chapters' | 'verses' | 'preview';

function App(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>('books');
  const [book, setBook] = useState<Book | null>(null);
  const [chapter, setChapter] = useState<number>(1);
  const [verses, setVerses] = useState<string[] | null>(null);
  const [selStart, setSelStart] = useState<number | null>(null);
  const [selEnd, setSelEnd] = useState<number | null>(null);

  const [previewSpans, setPreviewSpans] = useState<Span[]>([]);
  const [rows, setRows] = useState<VerseRow[]>([]);
  const [settings, setLocalSettings] = useState<Settings>(getSettings());

  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const updateSettings = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setLocalSettings(next);
    setSettings(next);
  };

  // ---- navigation -------------------------------------------------------

  const openBook = (b: Book) => {
    setBook(b);
    setError(null);
    if (b.chapters === 1) openChapter(b, 1);
    else setScreen('chapters');
  };

  const openChapter = useCallback(async (b: Book, ch: number) => {
    setBook(b);
    setChapter(ch);
    setSelStart(null);
    setSelEnd(null);
    setVerses(null);
    setError(null);
    setScreen('verses');
    try {
      setVerses(await getChapter(b, ch));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const showPreview = useCallback(async (spans: Span[]) => {
    setBusy(true);
    setError(null);
    try {
      const resolved = await resolveSpans(spans);
      if (!resolved.length) throw new Error('No verse text found for that reference.');
      setPreviewSpans(spans);
      setRows(resolved);
      setScreen('preview');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  const goFromQuery = async () => {
    const q = query.trim();
    if (!q) return;
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
    // Sync the picker with the typed reference so "Back" lands on that chapter with it selected.
    const first = parsed.spans[0];
    const oneRange = parsed.spans.length === 1 && first.startChapter === first.endChapter && first.startVerse !== null;
    setBook(first.book);
    setChapter(first.startChapter);
    setSelStart(oneRange ? first.startVerse : null);
    setSelEnd(oneRange ? first.endVerse : null);
    try {
      setVerses(await getChapter(first.book, first.startChapter));
    } catch {
      setVerses(null);
    }
    await showPreview(parsed.spans);
  };

  // ---- verse selection --------------------------------------------------

  const tapVerse = (v: number) => {
    if (selStart === null || selEnd !== null) {
      setSelStart(v);
      setSelEnd(null);
    } else if (v === selStart) {
      setSelEnd(v);
    } else {
      setSelEnd(Math.max(v, selStart));
      setSelStart(Math.min(v, selStart));
    }
  };

  const selection: Span | null = useMemo(() => {
    if (!book || selStart === null) return null;
    return { book, startChapter: chapter, startVerse: selStart, endChapter: chapter, endVerse: selEnd ?? selStart };
  }, [book, chapter, selStart, selEnd]);

  // ---- insert -----------------------------------------------------------

  const label = useMemo(() => formatSpans(previewSpans), [previewSpans]);
  const output = useMemo(() => buildText(rows, label, settings), [rows, label, settings]);

  const doInsert = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await insertPassage(output, settings);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNotice(res.overflow ? `${label} inserted. It is longer than one page, so check the bottom of the text box.` : `${label} inserted.`);
      // Leave the picker on the same chapter for the next insertion.
      setSelStart(null);
      setSelEnd(null);
      if (book) setScreen('verses');
      else setScreen('books');
      await closePanel();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  // ---- render -----------------------------------------------------------

  const back = () => {
    setError(null);
    if (screen === 'preview') setScreen(book && verses ? 'verses' : 'books');
    else if (screen === 'verses') setScreen(book && book.chapters > 1 ? 'chapters' : 'books');
    else if (screen === 'chapters') setScreen('books');
  };

  return (
    <View style={st.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.paper} />

      {/* Top bar: close, title, free-text reference */}
      <View style={st.top}>
        <View style={st.titleRow}>
          <Text style={st.title}>snBible</Text>
          <Text style={st.subtitle}>Berean Standard Bible</Text>
          <View style={st.flex} />
          <Button label="Close" kind="quiet" onPress={closePanel} />
        </View>
        <View style={st.searchRow}>
          <TextInput
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
      {notice ? (
        <View style={st.notice}>
          <Text style={st.noticeText}>{notice}</Text>
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
          selStart={selStart}
          selEnd={selEnd}
          onTap={tapVerse}
          onWhole={() => showPreview([{ book, startChapter: chapter, startVerse: null, endChapter: chapter, endVerse: null }])}
          onPrevNext={d => openChapter(book, chapter + d)}
          selection={selection}
          onPreview={() => selection && showPreview([selection])}
          onClear={() => {
            setSelStart(null);
            setSelEnd(null);
          }}
        />
      ) : null}
      {screen === 'preview' ? (
        <PreviewScreen
          label={label}
          output={output}
          verseCount={rows.length}
          settings={settings}
          onChange={updateSettings}
          onInsert={doInsert}
          busy={busy}
        />
      ) : null}
    </View>
  );
}

// ======================================================================
// Books
// ======================================================================

function BooksScreen({ onPick }: { onPick: (b: Book) => void }) {
  const ot = BOOKS.filter(b => b.testament === 'OT');
  const nt = BOOKS.filter(b => b.testament === 'NT');
  return (
    <ScrollView style={st.flex} contentContainerStyle={st.pad}>
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
    </ScrollView>
  );
}

function Cell({ label, onPress, width }: { label: string; onPress: () => void; width: `${number}%` }) {
  return (
    <View style={{ width, padding: 5 }}>
      <Pressable onPress={onPress} style={st.cell}>
        <Text style={st.cellText} numberOfLines={1} adjustsFontSizeToFit>
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
    <ScrollView style={st.flex} contentContainerStyle={st.pad}>
      <Text style={st.heading}>{book.name}</Text>
      <Text style={st.hint}>Choose a chapter.</Text>
      <View style={st.grid}>
        {nums.map(n => (
          <Cell key={n} label={String(n)} onPress={() => onPick(n)} width="12.5%" />
        ))}
      </View>
    </ScrollView>
  );
}

// ======================================================================
// Verses
// ======================================================================

function VersesScreen(props: {
  book: Book;
  chapter: number;
  verses: string[] | null;
  selStart: number | null;
  selEnd: number | null;
  selection: Span | null;
  onTap: (v: number) => void;
  onWhole: () => void;
  onPrevNext: (delta: number) => void;
  onPreview: () => void;
  onClear: () => void;
}) {
  const { book, chapter, verses, selStart, selEnd, selection } = props;
  const lo = selStart;
  const hi = selEnd ?? selStart;
  const heading = book.id === 'PSA' ? `Psalm ${chapter}` : `${book.name} ${chapter}`;

  const status =
    selStart === null
      ? 'Tap the first verse, then the last.'
      : selEnd === null
        ? `Verse ${selStart} selected. Tap the last verse, or tap ${selStart} again for just this one.`
        : `${formatSpans([selection as Span])}  ·  ${hi! - lo! + 1} verse${hi === lo ? '' : 's'}`;

  return (
    <View style={st.flex}>
      <View style={st.verseHeader}>
        <Text style={st.heading}>{heading}</Text>
        <View style={st.flex} />
        <Button label="‹" onPress={() => props.onPrevNext(-1)} disabled={chapter <= 1} style={st.navBtn} />
        <Button label="›" onPress={() => props.onPrevNext(1)} disabled={chapter >= book.chapters} style={st.navBtn} />
        <Button label="Whole chapter" onPress={props.onWhole} disabled={!verses} />
      </View>

      {!verses ? (
        <Text style={st.loading}>Loading {heading}…</Text>
      ) : (
        <ScrollView style={st.flex} contentContainerStyle={st.padList}>
          {verses.map((text, i) => {
            const v = i + 1;
            const on = lo !== null && hi !== null && v >= lo && v <= hi;
            const edge = v === lo || v === hi;
            if (!text) {
              return (
                <View key={v} style={st.verseRow}>
                  <Text style={st.verseNum}>{v}</Text>
                  <Text style={[st.verseText, st.omitted]}>Not in the BSB text (later manuscripts).</Text>
                </View>
              );
            }
            return (
              <Pressable key={v} onPress={() => props.onTap(v)} style={[st.verseRow, on && st.verseOn, edge && st.verseEdge]}>
                <Text style={[st.verseNum, on && st.verseNumOn]}>{v}</Text>
                <Text style={st.verseText} numberOfLines={on ? undefined : 2}>
                  {text}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <View style={st.bottomBar}>
        <Text style={st.status} numberOfLines={2}>
          {status}
        </Text>
        {selStart !== null ? <Button label="Clear" onPress={props.onClear} style={st.barBtn} /> : null}
        <Button label="Preview" kind="primary" onPress={props.onPreview} disabled={!selection} style={st.barBtn} />
      </View>
    </View>
  );
}

// ======================================================================
// Preview + options
// ======================================================================

function PreviewScreen(props: {
  label: string;
  output: string;
  verseCount: number;
  settings: Settings;
  onChange: (p: Partial<Settings>) => void;
  onInsert: () => void;
  busy: boolean;
}) {
  const { settings: s, onChange } = props;
  return (
    <View style={st.flex}>
      <ScrollView style={st.flex} contentContainerStyle={st.pad}>
        <Text style={st.heading}>{props.label}</Text>
        <Text style={st.hint}>
          {props.verseCount} verse{props.verseCount === 1 ? '' : 's'} · this is exactly what will go into your note
        </Text>

        <View style={st.paper}>
          <Text style={[st.scripture, s.bold && st.bold]}>{props.output}</Text>
        </View>

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
            ['lines', 'One verse per line'],
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
      </ScrollView>

      <View style={st.bottomBar}>
        <View style={st.flex} />
        <Button label={props.busy ? 'Inserting…' : 'Insert into note'} kind="primary" onPress={props.onInsert} disabled={props.busy} style={st.insertBtn} />
      </View>
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
  notice: { margin: 16, marginBottom: 0, padding: 16, backgroundColor: C.fill },
  noticeText: { fontSize: T.small, color: C.ink },
  loading: { fontSize: T.small, color: C.grey, marginTop: 16, marginHorizontal: 24 },

  section: { fontFamily: T.serif, fontSize: 24, color: C.ink, marginTop: 8, marginBottom: 8, fontStyle: 'italic' },
  heading: { fontFamily: T.serif, fontSize: 28, color: C.ink, fontWeight: '700' },
  hint: { fontSize: T.small, color: C.grey, marginTop: 6, marginBottom: 14 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5, marginBottom: 18 },
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
  scripture: { fontFamily: T.serif, fontSize: T.body, lineHeight: 34, color: C.ink },
  bold: { fontWeight: '700' },
  toggles: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
});

export default App;
