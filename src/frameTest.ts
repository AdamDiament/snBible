/**
 * TEMPORARY device experiment for the undocumented text box frame and colour fields.
 * Remove once the device results are in and the real options are built.
 *
 * sn-plugin-lib's native TextKey constants describe textFrameStyle 0=fill, 1=stroke,
 * 2=fill+stroke, others=none; textFrameFillColor/textFrameStrokeColor as 0 (black) … 255
 * (white); and textColor with no stated format. The public docs only list 0 (none) and
 * 3 (stroke), and 3 didn't draw a border on device. This panel lets the device tell us.
 */
import type { TextBoxLayout, Size } from './layout';

export type FrameTest = {
  mode: '0' | '1' | '2' | '3';
  fill: 'none' | '255' | '200' | '128' | '0';
  text: 'default' | 'white255' | 'whiteArgb';
};

export const FRAME_TEST_DEFAULT: FrameTest = { mode: '2', fill: '128', text: 'default' };

export function frameTestFields(t: FrameTest): Record<string, number> {
  const f: Record<string, number> = { textFrameStyle: Number(t.mode), textFrameWidth: 3, textFrameStrokeColor: 0 };
  if (t.fill !== 'none') {
    f.textFrameFillColor = Number(t.fill);
  }
  if (t.text === 'white255') {
    f.textColor = 255; // same 0–255 grey scale as the frame colours
  } else if (t.text === 'whiteArgb') {
    f.textColor = -1; // Android Color.WHITE, 0xFFFFFFFF as a signed int
  }
  return f;
}

/** First line of each test insert, so every box on the page says what it was. */
export function frameTestLabel(t: FrameTest): string {
  return `[mode ${t.mode} · fill ${t.fill} · text ${t.text}]`;
}

/** Move the box down one slot per test insert so a page of tests doesn't overlap; wraps to the top. */
export function stackBox(layout: TextBoxLayout, page: Size, slot: number): TextBoxLayout {
  const r = layout.textRect;
  const h = r.bottom - r.top;
  const gap = 24;
  const margin = Math.round(page.width * 0.07);
  const first = Math.round(page.height * 0.08);
  const slots = Math.max(1, Math.floor((Math.round(page.height) - margin - first) / (h + gap)));
  const top = first + (slot % slots) * (h + gap);
  return { ...layout, textRect: { ...r, top, bottom: top + h } };
}
