import { PluginCommAPI, PluginFileAPI, PointUtils } from 'sn-plugin-lib';
import type { Size } from './layout';

type Pt = { x: number; y: number };
type Accessor<T> = { size(): Promise<number>; getRange(start: number, count: number): Promise<T[]> };

/** The parts of an sn-plugin-lib Element this module reads. */
export type ElementLike = {
  type: number;
  numInPage?: number;
  stroke?: { points?: Accessor<Pt> } | null;
  textBox?: { textRect?: { bottom: number } } | null;
  geometry?: { points?: Pt[] } | null;
  contoursSrc?: Accessor<Pt[]> | null;
  recycle?: () => Promise<void>;
};

const TEXT_TYPES = [500, 501, 502];

async function readAll<T>(a: Accessor<T> | null | undefined): Promise<T[]> {
  if (!a) {
    return [];
  }
  const n = await a.size();
  return n > 0 ? await a.getRange(0, n) : [];
}

/**
 * Lowest pixel y of an element, or null if it can't be worked out.
 * Strokes and contours are in EMR (digitiser) units, converted with `emrToPx`;
 * text boxes and geometry are already in page pixels.
 */
export async function elementBottom(el: ElementLike, emrToPx: (p: Pt) => Pt): Promise<number | null> {
  if (TEXT_TYPES.includes(el.type) && el.textBox?.textRect) {
    return el.textBox.textRect.bottom;
  }
  if (el.geometry?.points?.length) {
    return Math.max(...el.geometry.points.map(p => p.y));
  }
  let emr: Pt[] = el.type === 0 ? await readAll(el.stroke?.points) : [];
  if (!emr.length) {
    emr = (await readAll(el.contoursSrc)).flat();
  }
  if (!emr.length) {
    return null;
  }
  return Math.max(...emr.map(p => emrToPx(p).y));
}

/** The most recently added of the page's live elements (numInPage counts up as things are added). */
export function latestElement<T extends { numInPage?: number }>(elements: T[]): T | null {
  let best: T | null = null;
  for (const el of elements) {
    if (!best || (el.numInPage ?? 0) >= (best.numInPage ?? 0)) {
      best = el;
    }
  }
  return best;
}

type Result<T> = { success?: boolean; result?: T | null } | null | undefined;

/**
 * The page's current elements. getLastElement isn't used for this: on device it still
 * returned strokes that had been erased or deleted, while getElements lists what's on the page now.
 * Returns null (not []) if the list can't be read, so the caller can fall back.
 */
async function liveElements(): Promise<ElementLike[] | null> {
  const [file, pageNum] = await Promise.all([
    PluginCommAPI.getCurrentFilePath() as Promise<Result<string>>,
    PluginCommAPI.getCurrentPageNum() as Promise<Result<number>>,
  ]);
  if (!file?.success || !file.result || !pageNum?.success || typeof pageNum.result !== 'number') {
    return null;
  }
  const res = (await PluginFileAPI.getElements(pageNum.result, file.result)) as Result<ElementLike[]>;
  return res?.success && Array.isArray(res.result) ? res.result : null;
}

/** Bottom edge (page px) of the most recent thing still on the current page, or null for an empty page. */
export async function lastWritingBottom(page: Size): Promise<number | null> {
  let elements: ElementLike[] = [];
  try {
    const live = await liveElements().catch(() => null);
    if (live) {
      elements = live;
    } else {
      // Older hosts: fall back to getLastElement, which may include erased items.
      const res = (await PluginFileAPI.getLastElement()) as Result<ElementLike>;
      elements = res?.success && res.result ? [res.result] : [];
    }
    const el = latestElement(elements);
    if (!el) {
      return null;
    }
    const bottom = await elementBottom(el, p => PointUtils.emrPoint2Android(p, page));
    return bottom !== null && Number.isFinite(bottom) ? Math.min(Math.round(bottom), page.height) : null;
  } catch {
    return null;
  } finally {
    for (const el of elements) {
      el.recycle?.().catch(() => {});
    }
  }
}
