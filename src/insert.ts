import { PluginCommAPI, PluginManager, PluginNoteAPI } from 'sn-plugin-lib';
import type { Settings } from './format';
import type { LassoTextBox, Rect } from './lasso';
import { DEFAULT_PAGE, layoutTextBox, Size } from './layout';
import { lastWritingBottom } from './pageContent';

// sn-plugin-lib types insertText/getPageDisplaySize as Promise<Object> and doesn't export
// APIResponse from its root, so describe the documented { success, result, error } shape here.
type ApiResult<T> = {
  success: boolean;
  result?: T | null;
  error?: { code: number; message: string } | null;
};

export async function pageSize(): Promise<Size> {
  try {
    const res = (await PluginCommAPI.getPageDisplaySize()) as ApiResult<Size> | null | undefined;
    // insertText validates textRect as integers, so keep everything derived from this whole.
    if (res?.success && res?.result?.width && res.result.height) {
      return { width: Math.round(res.result.width), height: Math.round(res.result.height) };
    }
  } catch {
    // fall through to the default
  }
  return DEFAULT_PAGE;
}

export type InsertOutcome = { ok: true } | { ok: false; error: string };

type FrameFields = { textRect: Rect; fontSize: number };

function textBoxFields(text: string, s: Settings, { textRect, fontSize }: FrameFields) {
  return {
    textContentFull: text,
    textRect,
    fontSize,
    textAlign: 0,
    textBold: s.bold ? 1 : 0,
    textItalics: 0,
    textFrameWidthType: 0, // fixed width, so the passage wraps inside the page margins
    // No frame. Borders and fills aren't usable from plugins yet: the documented stroke (3)
    // and the SDK's internal fill/stroke values (0-2, with fill colours) all drew nothing on device.
    textFrameStyle: 0,
    textEditable: 0,
  };
}

/** Run a write, asking for FILE:WRITE once if the note refuses with 1501. */
async function withWritePermission(call: () => Promise<unknown>): Promise<InsertOutcome> {
  let res = (await call()) as ApiResult<boolean> | null | undefined;
  if (!res?.success && res?.error?.code === 1501) {
    const perm = 'plugin.permission.FILE:WRITE';
    const granted = await PluginManager.requestPermission(perm, 'Super Bible needs permission to add the passage to your note.');
    if (granted === 1 || granted === 2) {
      res = (await call()) as ApiResult<boolean> | null | undefined;
    }
  }
  if (!res?.success || res.result !== true) {
    return { ok: false, error: res?.error?.message || 'The note did not accept the text box. Make sure a note page is open.' };
  }
  return { ok: true };
}

/** Insert where the placement setting says: below the last writing, at the top, or centred. */
export async function insertPassage(text: string, s: Settings): Promise<InsertOutcome> {
  const page = await pageSize();
  const below = s.placement === 'below' ? await lastWritingBottom(page) : null;
  const frame = layoutTextBox(text, page, s, { below });
  return withWritePermission(() => PluginNoteAPI.insertText(textBoxFields(text, s, frame)));
}

/**
 * Insert at the top of a lassoed handwritten reference. With `replace`, the handwriting is
 * deleted first, while the lasso is still active (inserting may clear the selection).
 */
export async function insertAtLasso(text: string, s: Settings, rect: Rect, replace: boolean): Promise<InsertOutcome> {
  const page = await pageSize();
  let removed = false;
  if (replace) {
    const del = (await PluginCommAPI.deleteLassoElements()) as ApiResult<boolean> | null | undefined;
    removed = !!del?.success;
  }
  const frame = layoutTextBox(text, page, s, { top: rect.top });
  const res = await withWritePermission(() => PluginNoteAPI.insertText(textBoxFields(text, s, frame)));
  if (!res.ok && removed) {
    return { ok: false, error: `${res.error} Your handwriting was removed; use Undo in the note to bring it back.` };
  }
  return res;
}

/** Replace the text of a lassoed Super Bible box, keeping its position and width. */
export async function updateLassoPassage(text: string, s: Settings, box: LassoTextBox): Promise<InsertOutcome> {
  const r = box.textRect;
  const frame = layoutTextBox(text, await pageSize(), s, { top: r.top, left: r.left, right: r.right });
  const fields = { ...textBoxFields(text, s, frame), ...(box.fontPath ? { fontPath: box.fontPath } : {}) };
  return withWritePermission(() => PluginNoteAPI.modifyLassoText(fields));
}

/**
 * Close the plugin UI without waiting. The host may not settle closePluginView's promise
 * once the view is hidden, and awaiting it used to leave the UI stuck in its busy state.
 */
export function closePanel(): void {
  try {
    PluginManager.closePluginView().catch(() => {});
  } catch {
    // ignore
  }
}
