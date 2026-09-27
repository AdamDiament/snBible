import { PluginFileAPI, PointUtils } from 'sn-plugin-lib';
import type { Size } from './layout';

type Pt = { x: number; y: number };
type Accessor<T> = { size(): Promise<number>; getRange(start: number, count: number): Promise<T[]> };

/** The parts of an sn-plugin-lib Element this module reads. */
export type ElementLike = {
  type: number;
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

/** Bottom edge (page px) of the last thing written on the current page, or null for an empty page. */
export async function lastWritingBottom(page: Size): Promise<number | null> {
  let el: ElementLike | null = null;
  try {
    const res = (await PluginFileAPI.getLastElement()) as { success?: boolean; result?: ElementLike | null } | null;
    el = res?.success ? res.result ?? null : null;
    if (!el) {
      return null;
    }
    const bottom = await elementBottom(el, p => PointUtils.emrPoint2Android(p, page));
    return bottom !== null && Number.isFinite(bottom) ? Math.min(Math.round(bottom), page.height) : null;
  } catch {
    return null;
  } finally {
    el?.recycle?.().catch(() => {});
  }
}
