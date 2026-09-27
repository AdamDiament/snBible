import React from 'react';
import { ScrollView, Text } from 'react-native';
import ReactTestRenderer, { act, ReactTestInstance, ReactTestRenderer as Renderer } from 'react-test-renderer';
import { ResumeKey, SafeScrollView } from '../src/ui/SafeScrollView';
import { DEFAULT_SETTINGS, setSettings } from '../src/format';
import { buttonPressed } from '../src/buttons';

// A fake Supernote host: an in-memory plugin folder, a lasso selection, and the page's last element.
const mockHost = {
  fs: new Set<string>(),
  life: null as { onMsg: (msg: { state: number }) => void } | null,
  lassoElements: [] as unknown[],
  recognized: '',
  lassoRect: { left: 100, top: 900, right: 700, bottom: 980 },
  lastElement: null as unknown,
};
const mockClose = jest.fn(() => new Promise<boolean>(() => {})); // never settles, like a hidden host view
const mockInsertText = jest.fn(async (_box: unknown) => ({ success: true, result: true }));
const mockModifyLassoText = jest.fn(async (_box: unknown) => ({ success: true, result: true }));
const mockDeleteLasso = jest.fn(async () => ({ success: true, result: true }));

jest.mock('sn-plugin-lib', () => {
  const under = (dir: string) => [...mockHost.fs].filter(p => p.startsWith(`${dir}/`) && !p.slice(dir.length + 1).includes('/'));
  return {
    PluginManager: {
      registerPluginLifeListener: (l: typeof mockHost.life) => {
        mockHost.life = l;
        return { remove: () => (mockHost.life = null) };
      },
      getPluginDirPath: async () => '/plugins/snBible',
      closePluginView: () => mockClose(),
      hasPermission: jest.fn(async () => 1),
      requestPermission: jest.fn(async () => 1),
    },
    PluginCommAPI: {
      getPageDisplaySize: jest.fn(async () => ({ success: true, result: { width: 1404, height: 1872 } })),
      getLassoElements: async () => ({ success: true, result: mockHost.lassoElements }),
      recognizeElements: async () => ({ success: true, result: mockHost.recognized }),
      getLassoRect: async () => ({ success: true, result: mockHost.lassoRect }),
      deleteLassoElements: () => mockDeleteLasso(),
    },
    PluginNoteAPI: {
      insertText: (box: unknown) => mockInsertText(box),
      modifyLassoText: (box: unknown) => mockModifyLassoText(box),
    },
    PluginFileAPI: { getLastElement: async () => ({ success: true, result: mockHost.lastElement }) },
    // Portrait A5X: EMR x runs down the page, roughly 8.45 EMR units per pixel.
    PointUtils: { emrPoint2Android: (p: { x: number; y: number }) => ({ x: p.y / 8.45, y: p.x / 8.45 }) },
    FileUtils: {
      exists: async (p: string) => mockHost.fs.has(p),
      listFiles: async (d: string) => under(d).map(path => ({ path, type: 0 })),
      makeDir: async (p: string) => {
        mockHost.fs.add(p);
        return true;
      },
      deleteDir: async (d: string) => {
        for (const p of [...mockHost.fs]) {
          if (p === d || p.startsWith(`${d}/`)) {
            mockHost.fs.delete(p);
          }
        }
        return true;
      },
    },
  };
});

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

const mounted: Renderer[] = [];

async function renderApp(): Promise<Renderer> {
  let r!: Renderer;
  await act(async () => {
    r = ReactTestRenderer.create(<App />);
  });
  mounted.push(r);
  return r;
}

afterEach(async () => {
  await act(async () => {
    for (const r of mounted.splice(0)) {
      try {
        r.unmount();
      } catch {
        // already unmounted by the test
      }
    }
  });
});

beforeEach(() => {
  mockClose.mockClear();
  mockInsertText.mockClear();
  mockModifyLassoText.mockClear();
  mockDeleteLasso.mockClear();
  mockHost.fs.clear();
  mockHost.lassoElements = [];
  mockHost.recognized = '';
  mockHost.lastElement = null;
  setSettings({ ...DEFAULT_SETTINGS });
});

type Box = { textContentFull: string; textRect: { left: number; top: number; right: number; bottom: number } };
const lastInsert = () => mockInsertText.mock.calls[mockInsertText.mock.calls.length - 1][0] as Box;

async function pressLassoButton(r: Renderer) {
  await act(async () => buttonPressed(101));
  // Let readLasso's promise chain settle.
  await act(async () => {});
  return r;
}

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


  test('settings and recent passages are saved and come back after a restart', async () => {
    const r = await renderApp();
    await search(r, 'John 3:16');
    await act(async () => control(r, 'Layout').props.onChange('spaced'));
    await press(r, 'Insert into note');
    expect([...mockHost.fs]).toEqual(
      expect.arrayContaining(['/plugins/snBible/superbible-state/s.layout=spaced', '/plugins/snBible/superbible-state/r.0=John%203%3A16']),
    );
    await act(async () => r.unmount());

    // A fresh process: in-memory settings are back to defaults until the saved state loads.
    setSettings({ ...DEFAULT_SETTINGS });
    const again = await renderApp();
    expect(allText(again)).toContain('Recent');
    await press(again, 'John 3:16');
    expect(allText(again)).toContain('this is exactly what will go into your note');
    expect(control(again, 'Layout').props.value).toBe('spaced');
  });

  test('below my writing: the passage goes under the last element on the page', async () => {
    mockHost.lastElement = { type: 500, textBox: { textRect: { left: 98, top: 300, right: 1306, bottom: 700 } } };
    const r = await renderApp();
    await search(r, 'John 3:16');
    expect(control(r, 'Place on page').props.value).toBe('below');
    await press(r, 'Insert into note');
    expect(lastInsert().textRect.top).toBeGreaterThan(700);
    expect(lastInsert().textRect.top).toBeLessThan(760);
  });

  test('below my writing, with handwriting as the last element (EMR points)', async () => {
    const points = [{ x: 8450, y: 3000 }, { x: 9295, y: 3100 }]; // lowest ≈ 1100 px
    mockHost.lastElement = { type: 0, stroke: { points: { size: async () => points.length, getRange: async () => points } } };
    const r = await renderApp();
    await search(r, 'John 3:16');
    await press(r, 'Insert into note');
    expect(lastInsert().textRect.top).toBeGreaterThan(1100);
  });

  test('below my writing warns when the page is nearly full', async () => {
    mockHost.lastElement = { type: 500, textBox: { textRect: { left: 98, top: 1500, right: 1306, bottom: 1780 } } };
    const r = await renderApp();
    await search(r, 'John 3:16-18');
    expect(allText(r)).toContain("There isn't room below your writing on this page");
  });

  test('lasso handwriting: reads the reference, replaces the handwriting, inserts where it was', async () => {
    mockHost.lassoElements = [{ type: 0 }];
    mockHost.recognized = 'Jn 3v16';
    const r = await pressLassoButton(await renderApp());
    const text = allText(r);
    expect(text).toContain('From your lassoed handwriting');
    expect(text).toContain('John 3:16 (BSB)');
    expect(text).toContain('Placed where you lassoed.');
    await press(r, 'Insert here');
    expect(mockDeleteLasso).toHaveBeenCalledTimes(1);
    expect(mockDeleteLasso.mock.invocationCallOrder[0]).toBeLessThan(mockInsertText.mock.invocationCallOrder[0]);
    expect(lastInsert().textRect.top).toBe(900);
    expect(allText(r)).not.toContain('From your lassoed handwriting');
  });

  test('lasso handwriting can be kept', async () => {
    mockHost.lassoElements = [{ type: 0 }];
    mockHost.recognized = 'Rom 8:28';
    const r = await pressLassoButton(await renderApp());
    await act(async () => control(r, 'Replace handwriting').props.onChange(false));
    await press(r, 'Insert here');
    expect(mockDeleteLasso).not.toHaveBeenCalled();
    expect(mockInsertText).toHaveBeenCalledTimes(1);
  });

  test('unreadable handwriting goes into the search box to correct', async () => {
    mockHost.lassoElements = [{ type: 0 }];
    mockHost.recognized = 'Jahn tree';
    const r = await pressLassoButton(await renderApp());
    expect(allText(r)).toContain('Read “Jahn tree” from your handwriting');
    const input = r.root.find(n => n.props.placeholder?.startsWith?.('Type a reference'));
    expect(input.props.value).toBe('Jahn tree');
  });

  test('lasso a Super Bible text box: edit the range and update it in place', async () => {
    const rect = { left: 200, top: 300, right: 1000, bottom: 500 };
    mockHost.lassoElements = [{ type: 500, textBox: { textContentFull: 'John 3:16 (BSB)\n16 For God so loved the world…', textRect: rect } }];
    const r = await pressLassoButton(await renderApp());
    expect(allText(r)).toContain('Updating the lassoed text box.');
    expect(allText(r)).toContain('The text box stays where it is.');
    // Extend the range from the verse list, then update.
    await press(r, '‹ Back');
    await tapVerse(r, 16);
    await tapVerse(r, 18);
    await press(r, 'Preview');
    await press(r, 'Update text box');
    expect(mockInsertText).not.toHaveBeenCalled();
    const box = mockModifyLassoText.mock.calls[0][0] as Box;
    expect(box.textContentFull.startsWith('John 3:16–18 (BSB)')).toBe(true);
    expect(box.textRect).toMatchObject({ left: 200, top: 300, right: 1000 });
  });

  test('a text box without a reference is refused', async () => {
    mockHost.lassoElements = [{ type: 500, textBox: { textContentFull: 'Shopping: eggs, milk', textRect: { left: 1, top: 1, right: 500, bottom: 90 } } }];
    const r = await pressLassoButton(await renderApp());
    expect(allText(r)).toContain("doesn't contain a Bible reference");
  });

  test('a lasso press that arrives before App has loaded is not lost', async () => {
    mockHost.lassoElements = [{ type: 0 }];
    mockHost.recognized = 'Ps 23';
    buttonPressed(101); // before any render
    const r = await renderApp();
    await act(async () => {});
    expect(allText(r)).toContain('From your lassoed handwriting');
    expect(allText(r)).toContain('Psalm 23 (BSB)');
  });

  test('opening from the main toolbar leaves lasso mode', async () => {
    mockHost.lassoElements = [{ type: 0 }];
    mockHost.recognized = 'Ps 23';
    const r = await pressLassoButton(await renderApp());
    expect(allText(r)).toContain('From your lassoed handwriting');
    await act(async () => buttonPressed(100));
    expect(allText(r)).not.toContain('From your lassoed handwriting');
  });

  test('the preview box is capped so the options stay in view', async () => {
    const r = await renderApp();
    await search(r, 'Ps 119:1-30');
    const capped = r.root.findAll(n => typeof n.props.style === 'object' && [n.props.style].flat().some((s: { maxHeight?: number }) => s?.maxHeight));
    expect(capped.length).toBeGreaterThan(0);
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
    await act(async () => mockHost.life?.onMsg({ state: 2 }));
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
