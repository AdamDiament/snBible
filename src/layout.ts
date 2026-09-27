import type { Settings } from './format';

export type Size = { width: number; height: number };

export type TextBoxLayout = {
  textRect: { left: number; top: number; right: number; bottom: number };
  fontSize: number;
  /** Estimated height the text needs, in page pixels. */
  wanted: number;
  /** True when the text is estimated to run past one page. */
  overflow: boolean;
  /** False when the box had to move up from where it was asked to go, so it may overlap writing. */
  room: boolean;
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
 * Where to put the box, beyond the placement setting:
 * - `below`: bottom edge (px) of the last thing written, for placement 'below' (null = empty page);
 * - `top`/`left`/`right`: an exact spot, for a lassoed position or an existing box being updated.
 */
export type Anchor = { below?: number | null; top?: number; left?: number; right?: number };

/**
 * Where the text box goes on the page. All values are whole pixels, because
 * insertText rejects a textRect with fractional or zero-area coordinates.
 */
export function layoutTextBox(
  text: string,
  page: Size,
  s: Pick<Settings, 'textSize' | 'placement'>,
  at: Anchor = {},
): TextBoxLayout {
  const width = Math.round(page.width);
  const height = Math.round(page.height);
  const margin = Math.round(width * 0.07);
  const fontSize = Math.max(16, Math.round(width * SIZE_FACTOR[s.textSize]));
  let left = at.left !== undefined ? Math.round(at.left) : margin;
  let right = at.right !== undefined ? Math.round(at.right) : width - margin;
  if (right - left < fontSize * 4) {
    // Too narrow to read (or inverted): fall back to the page margins.
    left = margin;
    right = width - margin;
  }
  const wanted = estimateHeight(text, right - left, fontSize);
  const maxHeight = height - margin * 2;
  const boxHeight = Math.max(1, Math.min(wanted, maxHeight));

  let top: number;
  if (at.top !== undefined) {
    top = Math.round(at.top);
  } else if (s.placement === 'below' && at.below != null) {
    top = Math.round(at.below + fontSize * 0.8);
  } else if (s.placement === 'middle') {
    top = Math.round((height - boxHeight) / 2);
  } else {
    top = Math.round(height * 0.08);
  }
  let room = true;
  if (top + boxHeight > height - margin) {
    room = false;
    top = Math.max(margin, height - margin - boxHeight);
  }
  top = Math.max(0, top);

  return {
    textRect: { left, top, right, bottom: top + boxHeight },
    fontSize,
    wanted,
    overflow: wanted > maxHeight,
    room,
  };
}
