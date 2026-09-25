import { PluginCommAPI, PluginManager, PluginNoteAPI } from 'sn-plugin-lib';
import type { Settings } from './format';

const SIZE_FACTOR: Record<Settings['textSize'], number> = {
  small: 0.018, // ≈25 px on A5X/A6X2 (1404 wide), ≈35 px on Manta (1920 wide)
  medium: 0.022,
  large: 0.027,
};

type Size = { width: number; height: number };

// sn-plugin-lib types insertText/getPageDisplaySize as Promise<Object> and doesn't export
// APIResponse from its root, so describe the documented { success, result, error } shape here.
type ApiResult<T> = {
  success: boolean;
  result?: T | null;
  error?: { code: number; message: string } | null;
};

async function pageSize(): Promise<Size> {
  const res = (await PluginCommAPI.getPageDisplaySize()) as ApiResult<Size> | null | undefined;
  // insertText validates textRect as integers, so keep everything derived from this whole.
  if (res?.success && res?.result?.width && res.result.height) {
    return { width: Math.round(res.result.width), height: Math.round(res.result.height) };
  }
  // Fall back to A5X/A6X2 portrait if the host can't tell us.
  return { width: 1404, height: 1872 };
}

/** Rough height estimate so the text box starts with a sensible frame. */
function estimateHeight(text: string, boxWidth: number, fontSize: number): number {
  const charsPerLine = Math.max(10, Math.floor(boxWidth / (fontSize * 0.5)));
  const lines = text
    .split('\n')
    .reduce((n, para) => n + Math.max(1, Math.ceil(para.length / charsPerLine)), 0);
  return Math.ceil(lines * fontSize * 1.45 + fontSize);
}

export type InsertOutcome = { ok: true; overflow: boolean } | { ok: false; error: string };

export async function insertPassage(text: string, s: Settings): Promise<InsertOutcome> {
  const page = await pageSize();
  const margin = Math.round(page.width * 0.07);
  const fontSize = Math.max(16, Math.round(page.width * SIZE_FACTOR[s.textSize]));
  const left = margin;
  const right = page.width - margin;
  const wanted = estimateHeight(text, right - left, fontSize);
  const maxHeight = page.height - margin * 2;
  const height = Math.min(wanted, maxHeight);

  let top = s.placement === 'middle' ? Math.round((page.height - height) / 2) : Math.round(page.height * 0.08);
  if (top + height > page.height - margin) top = Math.max(margin, page.height - margin - height);

  const textBox = {
    textContentFull: text,
    textRect: { left, top, right, bottom: top + height },
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
    const granted = await PluginManager.requestPermission(perm, 'snBible needs permission to add the passage to your note.');
    if (granted === 1 || granted === 2) res = await insert();
  }

  if (!res?.success || res.result !== true) {
    return { ok: false, error: res?.error?.message || 'The note did not accept the text box. Make sure a note page is open.' };
  }
  return { ok: true, overflow: wanted > maxHeight };
}

export async function closePanel(): Promise<void> {
  try {
    await PluginManager.closePluginView();
  } catch {
    // ignore
  }
}
