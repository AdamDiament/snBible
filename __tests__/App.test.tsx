import React from 'react';
import { ScrollView, Text } from 'react-native';
import ReactTestRenderer, { act, ReactTestInstance, ReactTestRenderer as Renderer } from 'react-test-renderer';
import { ResumeKey, SafeScrollView } from '../src/ui/SafeScrollView';

let lifeListener: { onMsg: (msg: { state: number }) => void } | null = null;
const mockClose = jest.fn(() => new Promise<boolean>(() => {})); // never settles, like a hidden host view
const mockInsertText = jest.fn(async (_box: unknown) => ({ success: true, result: true }));

jest.mock('sn-plugin-lib', () => ({
  PluginManager: {
    registerPluginLifeListener: (l: typeof lifeListener) => {
      lifeListener = l;
      return { remove: () => (lifeListener = null) };
    },
    closePluginView: () => mockClose(),
    hasPermission: jest.fn(async () => 1),
    requestPermission: jest.fn(async () => 1),
  },
  PluginCommAPI: { getPageDisplaySize: jest.fn(async () => ({ success: true, result: { width: 1404, height: 1872 } })) },
  PluginNoteAPI: { insertText: (box: unknown) => mockInsertText(box) },
}));

// Imported after the mock so App picks it up.
import App from '../App';

// ---- helpers ------------------------------------------------------------

function allText(r: Renderer): string {
  return r.root
    .findAllByType(Text)
    .map(t => [t.props.children].flat(3).filter(c => typeof c === 'string' || typeof c === 'number').join(''))
    .join('\n');
}

/** Buttons and grid cells both take { label, onPress }. */
function pressable(r: Renderer, label: string): ReactTestInstance {
  const hits = r.root.findAll(n => n.props.label === label && typeof n.props.onPress === 'function', { deep: false });
  if (!hits.length) {
    throw new Error(`No button "${label}"`);
  }
  return hits[0];
}

async function press(r: Renderer, label: string) {
  await act(async () => {
    await pressable(r, label).props.onPress();
  });
}

/** Choice, Toggle and similar controls take { label, onChange }. */
function control(r: Renderer, label: string): ReactTestInstance {
  return r.root.find(n => n.props.label === label && typeof n.props.onChange === 'function');
}

async function tapVerse(r: Renderer, v: number) {
  const item = r.root.find(n => n.props.v === v && typeof n.props.onTap === 'function');
  await act(async () => item.props.onTap(v));
}

async function search(r: Renderer, ref: string) {
  const input = r.root.find(n => n.props.placeholder?.startsWith?.('Type a reference'));
  await act(async () => input.props.onChangeText(ref));
  await press(r, 'Go');
}

async function renderApp(): Promise<Renderer> {
  let r!: Renderer;
  await act(async () => {
    r = ReactTestRenderer.create(<App />);
  });
  return r;
}

beforeEach(() => {
  mockClose.mockClear();
  mockInsertText.mockClear();
});

// ---- App ------------------------------------------------------------------

describe('App', () => {
  test('shows the new name', async () => {
    const r = await renderApp();
    expect(allText(r)).toContain('Super Bible');
  });

  test('tapping a chapter number opens the verse list', async () => {
    const r = await renderApp();
    await press(r, 'John');
    await press(r, '3');
    const text = allText(r);
    expect(text).toContain('John 3');
    expect(text).toContain('Tap the first and last verse, in either order (up to 30).');
    expect(text).toContain('For God so loved the world');
  });

  test('typing a whole chapter opens its verse list, not the preview', async () => {
    const r = await renderApp();
    await search(r, 'Ps 23');
    const text = allText(r);
    expect(text).toContain('Psalm 23');
    expect(text).toContain('Tap the first and last verse');
    expect(text).not.toContain('this is exactly what will go into your note');
  });

  test('verses can be tapped last-first, then previewed', async () => {
    const r = await renderApp();
    await search(r, 'John 3');
    await tapVerse(r, 18);
    await tapVerse(r, 16);
    expect(allText(r)).toContain('John 3:16–18  ·  3 verses');
    await press(r, 'Preview');
    expect(allText(r)).toContain('this is exactly what will go into your note');
    expect(allText(r)).toContain('John 3:16–18 (BSB)');
  });

  test('a long tap range is capped at 30 verses', async () => {
    const r = await renderApp();
    await search(r, 'Ps 119');
    await tapVerse(r, 1);
    await tapVerse(r, 100);
    expect(allText(r)).toContain('Psalm 119:1–30  ·  30 verses, the most at once');
  });

  test('whole chapter is disabled when it is over the limit, and typed long passages are refused', async () => {
    const r = await renderApp();
    await search(r, 'Gen 1');
    expect(pressable(r, 'Whole chapter (over 30)').props.disabled).toBe(true);
    await search(r, 'Gen 1:1-40');
    expect(allText(r)).toContain('That passage is more than 30 verses');
  });

  test('spaced list reaches insertText', async () => {
    const r = await renderApp();
    await search(r, 'John 3:16-17');
    await act(async () => control(r, 'Layout').props.onChange('spaced'));
    await press(r, 'Insert into note');
    const box = mockInsertText.mock.calls[0][0] as { textContentFull: string };
    expect(box.textContentFull).toContain('\n\n16 For God so loved');
  });

  test('frame test labels each insert, sends its fields, and stacks boxes down the page', async () => {
    const r = await renderApp();
    await search(r, 'John 3:16');
    await act(async () => control(r, 'Use frame test for inserts').props.onChange(true));
    await act(async () => control(r, 'Fill colour (0 black … 255 white)').props.onChange('0'));
    await act(async () => control(r, 'Text colour').props.onChange('whiteArgb'));
    await press(r, 'Insert into note');
    // Back on the John 3 verse list; the frame test stays on for the next insert.
    await tapVerse(r, 16);
    await press(r, 'Preview');
    await press(r, 'Insert into note');
    type Box = { textContentFull: string; textRect: { top: number }; textFrameStyle: number; textFrameFillColor?: number; textColor?: number };
    const [a, b] = mockInsertText.mock.calls.map(c => c[0] as Box);
    expect(a.textContentFull.split('\n')[0]).toBe('[mode 2 · fill 0 · text whiteArgb]');
    expect(a).toMatchObject({ textFrameStyle: 2, textFrameFillColor: 0, textColor: -1 });
    expect(b.textRect.top).toBeGreaterThan(a.textRect.top);
  });

  test('inserting finishes even though closePluginView never settles', async () => {
    const r = await renderApp();
    await search(r, 'John 3:16');
    await press(r, 'Insert into note');
    expect(mockInsertText).toHaveBeenCalledTimes(1);
    expect(mockClose).toHaveBeenCalledTimes(1);
    const text = allText(r);
    expect(text).not.toContain('Loading…');
    expect(text).not.toContain('Inserting…');
    // Back on the verse list, ready for the next passage.
    expect(text).toContain('Tap the first and last verse');
  });

  test('the host showing the plugin again remounts the scroll views', async () => {
    const r = await renderApp();
    const before = r.root.findByType(ScrollView);
    await act(async () => lifeListener?.onMsg({ state: 2 }));
    expect(r.root.findByType(ScrollView)).not.toBe(before);
  });
});

// ---- SafeScrollView -------------------------------------------------------

describe('SafeScrollView', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const scrollEvent = (y: number) => ({ nativeEvent: { contentOffset: { x: 0, y } } });

  test('always lets taps through to buttons', () => {
    let r!: Renderer;
    act(() => {
      r = ReactTestRenderer.create(<SafeScrollView />);
    });
    expect(r.root.findByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
  });

  test('remounts at the same position when a fling never reports ending', () => {
    let r!: Renderer;
    act(() => {
      r = ReactTestRenderer.create(<SafeScrollView />);
    });
    const first = r.root.findByType(ScrollView);
    act(() => {
      first.props.onScroll(scrollEvent(640));
      first.props.onMomentumScrollBegin(scrollEvent(640));
    });
    act(() => {
      jest.advanceTimersByTime(2500);
    });
    const second = r.root.findByType(ScrollView);
    expect(second).not.toBe(first);
    expect(second.props.contentOffset).toEqual({ x: 0, y: 640 });
  });

  test('leaves a normal fling alone', () => {
    let r!: Renderer;
    act(() => {
      r = ReactTestRenderer.create(<SafeScrollView />);
    });
    const first = r.root.findByType(ScrollView);
    act(() => {
      first.props.onMomentumScrollBegin(scrollEvent(100));
      first.props.onMomentumScrollEnd(scrollEvent(300));
    });
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(r.root.findByType(ScrollView)).toBe(first);
  });

  test('remounts when the resume key changes', () => {
    let r!: Renderer;
    act(() => {
      r = ReactTestRenderer.create(
        <ResumeKey.Provider value={0}>
          <SafeScrollView />
        </ResumeKey.Provider>,
      );
    });
    const first = r.root.findByType(ScrollView);
    act(() => {
      r.update(
        <ResumeKey.Provider value={1}>
          <SafeScrollView />
        </ResumeKey.Provider>,
      );
    });
    expect(r.root.findByType(ScrollView)).not.toBe(first);
  });
});
