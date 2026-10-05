import type { Range } from './model';

/** Length of `text` in Unicode code points, the unit of every archive range. */
export function codePointLength(text: string): number {
  let length = 0;
  for (const _ of text) length += 1;
  return length;
}

/** Slices `text` by code point offsets. */
export function sliceCodePoints(text: string, start: number, end?: number): string {
  return Array.from(text).slice(start, end).join('');
}

const X_ESCAPES: ReadonlyArray<readonly [string, string]> = [['&amp;', '&'], ['&lt;', '<'], ['&gt;', '>']];

export interface UnescapedText {
  text: string;
  /** Maps a code point offset in the escaped source to the same position in `text`. */
  mapOffset(offset: number): number;
}

/**
 * Reverses the HTML escaping X applies to `legacy.full_text` (`&`, `<`, `>` only).
 * Entity indices from X refer to the escaped text, so offsets are remapped.
 */
export function unescapeXText(source: string): UnescapedText {
  const points = Array.from(source);
  const offsets = new Array<number>(points.length + 1);
  let text = '';
  let output = 0;

  for (let index = 0; index < points.length;) {
    offsets[index] = output;
    const escape = points[index] === '&'
      ? X_ESCAPES.find(([sequence]) => points.slice(index, index + sequence.length).join('') === sequence)
      : undefined;

    if (escape) {
      for (let inner = 1; inner < escape[0].length; inner += 1) offsets[index + inner] = output;
      text += escape[1];
      index += escape[0].length;
    } else {
      text += points[index];
      index += 1;
    }
    output += 1;
  }
  offsets[points.length] = output;

  return {
    text,
    mapOffset: (offset) => offsets[Math.max(0, Math.min(points.length, offset))],
  };
}

export function isValidRange(range: Range, length: number): boolean {
  return range[0] <= range[1] && range[1] <= length;
}
