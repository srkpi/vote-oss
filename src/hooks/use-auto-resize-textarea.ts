import { useLayoutEffect, useRef } from 'react';

/**
 * Grows a textarea to fit its content instead of clipping it inside a
 * fixed-height box with an internal scrollbar. Re-measures on mount and
 * whenever `value` changes — including an external reset, e.g. clearing
 * the field after a successful submit — so a pre-filled value (editing an
 * existing comment) sizes correctly right away instead of jumping on the
 * first keystroke.
 *
 * `useLayoutEffect` (rather than `useEffect`) measures and applies the
 * new height before the browser paints, avoiding a visible flash/jump.
 *
 * Usage: `<Textarea ref={useAutoResizeTextarea(value)} value={value} ... />`
 * The textarea should also keep `resize-none` (manual dragging would
 * fight with the automatic height) and a `max-h-*` cap with
 * `overflow-y-auto`, so an extremely long value scrolls instead of
 * growing without bound.
 */
export function useAutoResizeTextarea(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reset height to auto to accurately measure the new height
    el.style.height = 'auto';

    // Get the current computed styles to find the border widths
    const computedStyle = window.getComputedStyle(el);
    const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
    const borderBottom = parseFloat(computedStyle.borderBottomWidth) || 0;

    // Add the borders to the scrollHeight so the text isn't squished
    el.style.height = `${el.scrollHeight + borderTop + borderBottom}px`;
  }, [value]);

  return ref;
}
