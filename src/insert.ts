import { PluginCommAPI, PluginManager, PluginNoteAPI } from 'sn-plugin-lib';
import type { Settings } from './format';
import { DEFAULT_PAGE, layoutTextBox, Size } from './layout';

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

export async function insertPassage(text: string, s: Settings): Promise<InsertOutcome> {
  const { textRect, fontSize } = layoutTextBox(text, await pageSize(), s);

  const textBox = {
    textContentFull: text,
    textRect,
    fontSize,
    textAlign: 0,
    textBold: s.bold ? 1 : 0,
    textItalics: 0,
    textFrameWidthType: 0, // fixed width, so the passage wraps inside the page margins
    textFrameStyle: s.border ? 3 : 0,
    textEditable: 0,
  };

  const insert = async () => (await PluginNoteAPI.insertText(textBox)) as ApiResult<boolean> | null | undefined;
  let res = await insert();

  // 1501 = write permission missing. Ask once, then retry.
  if (!res?.success && res?.error?.code === 1501) {
    const perm = 'plugin.permission.FILE:WRITE';
    const granted = await PluginManager.requestPermission(perm, 'Super Bible needs permission to add the passage to your note.');
    if (granted === 1 || granted === 2) { res = await insert(); }
  }

  if (!res?.success || res.result !== true) {
    return { ok: false, error: res?.error?.message || 'The note did not accept the text box. Make sure a note page is open.' };
  }
  return { ok: true };
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
