/**
 * Shared bookkeeping for dialogs that open on their own layer at the end of `<body>`.
 *
 * <p>Body scroll is locked per document, not per dialog: with a modal opened from a drawer, the first
 * one to close must not hand scrolling back while the other still covers the page. So each document
 * keeps a count of open overlays and the overflow value it had before the first one opened, and only
 * the last unlock restores it.</p>
 */
const locks = new WeakMap<Document, { count: number; previous: string }>();

export function lockBodyScroll(doc: Document): void {
  const body = doc.body;
  if (!body) return;
  const lock = locks.get(doc);
  if (lock) {
    lock.count++;
    return;
  }
  locks.set(doc, { count: 1, previous: body.style.overflow });
  body.style.overflow = 'hidden';
}

export function unlockBodyScroll(doc: Document): void {
  const lock = locks.get(doc);
  if (!lock) return;
  if (--lock.count > 0) return;
  locks.delete(doc);
  if (doc.body) doc.body.style.overflow = lock.previous;
}

/**
 * Removes a layer that was moved to `<body>` if it is still there. Angular removes a view's root
 * nodes when the `@if` closes, but when the component that owns the dialog is destroyed it only
 * detaches the host element — and the layer is no longer inside the host, so without this the
 * backdrop would stay on screen forever.
 */
export function detachLayer(el: HTMLElement | null, doc: Document): void {
  if (el && el.parentNode === doc.body) el.remove();
}

/**
 * Sends a dialog body back to its top when its content is swapped for other content (the nodes it
 * holds are replaced, not just added to: a growing list keeps its place). No animation. Returns a stop
 * function. Used by `ui-modal` and `ui-bottom-sheet`, whose body is reused while an app changes what
 * it projects.
 */
export function resetScrollOnSwap(el: HTMLElement): () => void {
  if (typeof MutationObserver === 'undefined') return () => undefined;
  const real = (list: NodeList) => Array.from(list).some((n) => n.nodeType === 1);
  const mo = new MutationObserver((records) => {
    let removed = false;
    let added = false;
    for (const r of records) {
      removed ||= real(r.removedNodes);
      added ||= real(r.addedNodes);
    }
    if (removed && added) el.scrollTop = 0;
  });
  mo.observe(el, { childList: true });
  return () => mo.disconnect();
}
