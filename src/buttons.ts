/** Button ids registered in index.js; App tells them apart when a press arrives. */
export const TOOLBAR_BUTTON = 100;
export const LASSO_BUTTON = 101;

type Handler = (id: number) => void;
let handler: Handler | null = null;
let pending: number | null = null;

/**
 * Called from the button listener index.js registers at startup. The SDK only replays a
 * press to late listeners for 1 s, and App's first render (which loads the bundled text)
 * can take longer than that, so a press that arrives before App is ready waits here.
 */
export function buttonPressed(id: number): void {
  if (handler) {
    handler(id);
  } else {
    pending = id;
  }
}

/** App's handler; a press that arrived before it was set is delivered straight away. */
export function setButtonHandler(h: Handler | null): void {
  handler = h;
  if (h && pending !== null) {
    const id = pending;
    pending = null;
    h(id);
  }
}
