import type { Settings } from './format';

export type Size = { width: number; height: number };

export type TextBoxLayout = {
  textRect: { left: number; top: number; right: number; bottom: number };
  fontSize: number;
  /** Estimated height the text needs, in page pixels. */
  wanted: number;
  /** True when the text is estimated to run past one page. */
  overflow: boolean;
};

export const SIZE_FACTOR: Record<Settings['textSize'], number> = {
  small: 0.018, // ≈25 px on A5X/A6X2 (1404 wide), ≈35 px on Manta (1920 wide)
  medium: 0.022,
  large: 0.027,
};

/** A5X/A6X2 portrait, used when the host can't report the page size. */
export const DEFAULT_PAGE: Size = { width: 1404, height: 1872 };

/** Rough height estimate so the text box starts with a sensible frame. */
export function estimateHeight(text: string, boxWidth: number, fontSize: number): number {
  const charsPerLine = Math.max(10, Math.floor(boxWidth / (fontSize * 0.5)));
  const lines = text.split('\n').reduce((n, para) => n + Math.max(1, Math.ceil(para.length / charsPerLine)), 0);
  return Math.ceil(lines * fontSize * 1.45 + fontSize);
}

/**
 * Where the text box goes on the page. All values are whole pixels, because
 * insertText rejects a textRect with fractional or zero-area coordinates.
 */
export function layoutTextBox(text: string, page: Size, s: Pick<Settings, 'textSize' | 'placement'>): TextBoxLayout {
  const width = Math.round(page.width);
  const height = Math.round(page.height);
  const margin = Math.round(width * 0.07);
  const fontSize = Math.max(16, Math.round(width * SIZE_FACTOR[s.textSize]));
  const left = margin;
  const right = width - margin;
  const wanted = estimateHeight(text, right - left, fontSize);
  const maxHeight = height - margin * 2;
  const boxHeight = Math.max(1, Math.min(wanted, maxHeight));

  let top = s.placement === 'middle' ? Math.round((height - boxHeight) / 2) : Math.round(height * 0.08);
  if (top + boxHeight > height - margin) {
    top = Math.max(margin, height - margin - boxHeight);
  }

  return {
    textRect: { left, top, right, bottom: top + boxHeight },
    fontSize,
    wanted,
    overflow: wanted > maxHeight,
  };
}

/**
 * Frame fields for insertText.
 *
 * The documented values are textFrameStyle 0 (none) and 3 (stroke). A background fill
 * isn't documented, but sn-plugin-lib's native TextKey constants describe
 * 0=fill, 1=stroke, 2=fill+stroke and a textFrameFillColor (0 black … 255 white), and
 * insertText passes extra fields through to the note app untouched. So the background
 * option sends those and relies on the device to confirm whether the host honours them.
 */
export function textFrame(s: Pick<Settings, 'border' | 'background'>): Record<string, number> {
  if (!s.background) {
    return { textFrameStyle: s.border ? 3 : 0 };
  }
  return { textFrameStyle: s.border ? 2 : 0, textFrameFillColor: 255, textFrameStrokeColor: 0 };
}
