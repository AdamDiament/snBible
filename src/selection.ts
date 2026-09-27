/**
 * Verse-list selection: tap one verse, then another, in either order.
 *
 * `anchor` is the first verse tapped and `other` the second (null until then).
 * The range is whichever of the two is lower up to whichever is higher, capped
 * at MAX_VERSES counted from the anchor. A third tap starts a new selection.
 */
export const MAX_VERSES = 30;

export type Selection = { anchor: number; other: number | null; clamped: boolean } | null;

export function tapVerse(sel: Selection, v: number, max: number = MAX_VERSES): Selection {
  if (!sel || sel.other !== null) {
    return { anchor: v, other: null, clamped: false };
  }
  const reach = max - 1;
  const other = v >= sel.anchor ? Math.min(v, sel.anchor + reach) : Math.max(v, sel.anchor - reach);
  return { anchor: sel.anchor, other, clamped: other !== v };
}

/** The selected verses, low to high. A single tap selects just that verse. */
export function selectionRange(sel: Selection): { lo: number; hi: number } | null {
  if (!sel) {
    return null;
  }
  const b = sel.other ?? sel.anchor;
  return { lo: Math.min(sel.anchor, b), hi: Math.max(sel.anchor, b) };
}

/** Status line under the verse list. `label` is the formatted reference, e.g. "John 3:16–18". */
export function selectionStatus(sel: Selection, label: string, max: number = MAX_VERSES): string {
  const r = selectionRange(sel);
  if (!sel || !r) {
    return `Tap the first and last verse, in either order (up to ${max}).`;
  }
  if (sel.other === null) {
    return `Verse ${sel.anchor} selected. Tap another verse for a range, or Preview for just this one.`;
  }
  const n = r.hi - r.lo + 1;
  const count = `${n} verse${n === 1 ? '' : 's'}`;
  return sel.clamped ? `${label}  ·  ${count}, the most at once` : `${label}  ·  ${count}`;
}
