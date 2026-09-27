import { PluginCommAPI } from 'sn-plugin-lib';
import { parseReference, Span } from './reference';
import type { Size } from './layout';

export type Rect = { left: number; top: number; right: number; bottom: number };

/** A lassoed text box, as returned by getLassoElements (fields we pass back to modifyLassoText). */
export type LassoTextBox = { textContentFull: string; textRect: Rect; fontPath?: string | null };

export type LassoContext =
  | { kind: 'edit'; box: LassoTextBox; spans: Span[] }
  | { kind: 'lookup'; rect: Rect; recognized: string; spans: Span[] | null }
  | { kind: 'error'; message: string };

// ---- pure helpers -----------------------------------------------------------

/** Tidy handwriting-recognition output into something parseReference can read. */
export function cleanRecognized(text: string): string {
  return text
    .replace(/[\r\n]+/g, ' ')
    .replace(/(\d)\s*[vV]\s*(?=\d)/g, '$1:') // "3v16" → "3:16"
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find the reference in a text box: the first line (Super Bible's "above" label),
 * the last line ("— John 3:16 (BSB)"), or the whole text (a typed reference).
 */
export function referenceFromTextBox(text: string): Span[] | null {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
  if (!lines.length) {
    return null;
  }
  const candidates = [lines[0], lines[lines.length - 1], lines.join(' ')];
  for (const c of candidates) {
    const ref = c
      .replace(/^[—–-]\s*/, '')
      .replace(/\s*\(BSB\)\s*$/i, '')
      .trim();
    const parsed = parseReference(ref);
    if (parsed.ok) {
      return parsed.spans;
    }
  }
  return null;
}

// ---- device -----------------------------------------------------------------

type ApiResult<T> = { success?: boolean; result?: T | null; error?: { message?: string } | null } | null | undefined;
type LassoElement = { type: number; textBox?: LassoTextBox | null; recycle?: () => Promise<void> };

const TEXT_TYPES = [500, 501, 502];

/** Read the current lasso selection: one text box means edit it; handwriting means look it up. */
export async function readLasso(page: Size): Promise<LassoContext> {
  let elements: LassoElement[] = [];
  try {
    const res = (await PluginCommAPI.getLassoElements()) as ApiResult<LassoElement[]>;
    elements = res?.success && Array.isArray(res.result) ? res.result : [];
    const boxes = elements.filter(e => TEXT_TYPES.includes(e.type) && e.textBox);
    const strokes = elements.filter(e => e.type === 0);

    if (boxes.length === 1 && !strokes.length) {
      const box = boxes[0].textBox as LassoTextBox;
      const spans = referenceFromTextBox(box.textContentFull ?? '');
      return spans
        ? { kind: 'edit', box, spans }
        : { kind: 'error', message: "That text box doesn't contain a Bible reference, so Super Bible can't update it." };
    }
    if (boxes.length > 1) {
      return { kind: 'error', message: 'Lasso just one Super Bible text box to update it.' };
    }
    if (!strokes.length) {
      return { kind: 'error', message: 'Lasso a handwritten reference, or one Super Bible text box.' };
    }

    const [rec, rect] = await Promise.all([
      PluginCommAPI.recognizeElements(strokes, page) as Promise<ApiResult<string>>,
      PluginCommAPI.getLassoRect() as Promise<ApiResult<Rect>>,
    ]);
    if (!rec?.success || typeof rec.result !== 'string' || !rect?.success || !rect.result) {
      return { kind: 'error', message: "Couldn't read the handwriting. Try lassoing just the reference." };
    }
    const recognized = cleanRecognized(rec.result);
    const parsed = parseReference(recognized);
    return { kind: 'lookup', rect: rect.result, recognized, spans: parsed.ok ? parsed.spans : null };
  } catch (e) {
    return { kind: 'error', message: `Couldn't read the lasso selection. (${(e as Error)?.message ?? e})` };
  } finally {
    for (const el of elements) {
      el.recycle?.().catch(() => {});
    }
  }
}
