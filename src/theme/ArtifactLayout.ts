import type { Note } from "../ink/types";
import { inkBounds, inkLength } from "../ink/bounds";

const MAX_NOTE_WIDTH_FRACTION = 0.52;
const MIN_NOTE_WIDTH_FRACTION = 0.2;
const GUTTER_FRACTION = 0.045;
const COVERAGE_CEILING = 0.62; // vs bounding-box area of placed notes, not ink area

export interface Placement {
  note: Note;
  /** LOCAL to the `size` rect passed into `pages()` — origin (0,0) is
   * that rect's own top-left. The outer gutter margin is already baked
   * in here; a caller only needs to add its own content rect's offset
   * (e.g. `content.x + frame.x`), never a second gutter on top. */
  frame: { x: number; y: number; width: number; height: number };
  /** Degrees. */
  rotation: number;
}

export interface Page {
  placements: Placement[];
}

/**
 * FNV-1a 64-bit over the UTF-16 code units of `id`, salted into the offset
 * basis via XOR — deterministic per (id, salt) pair, forever. This is an
 * adaptation of the native app's hash for a string `Note.id` rather than a
 * Swift UUID's raw bytes: it cannot bit-match the native output, but it
 * only needs to be internally deterministic, which it is.
 */
function deterministicUnit(id: string, salt: number): number {
  let hash = 0xcbf29ce484222325n ^ BigInt(salt);
  const prime = 0x100000001b3n;
  for (let i = 0; i < id.length; i++) {
    hash = (hash ^ BigInt(id.charCodeAt(i))) * prime;
    hash = hash & 0xffffffffffffffffn; // wrap to 64 bits
  }
  return Number(hash % 10000n) / 10000;
}

/**
 * Row-packing "shelf" layout for the collective artifact — every note laid
 * out at a size driven by how much ink it holds (more ink -> bigger card,
 * eased with sqrt so the spread isn't linearly harsh), wrapped into rows
 * and paginated once a page's coverage or height budget is exceeded.
 * Ported 1:1 from the native ArtifactLayout algorithm.
 */
export function pages(notes: Note[], size: { width: number; height: number }): Page[] {
  if (notes.length === 0 || size.width <= 0 || size.height <= 0) return [];

  const gutter = size.width * GUTTER_FRACTION;
  const usable = {
    x: gutter,
    y: gutter,
    width: size.width - gutter * 2,
    height: size.height - gutter * 2,
  };

  const lengths = notes.map((n) => Math.max(inkLength(n), 1));
  const minLen = Math.min(...lengths);
  const maxLen = Math.max(...lengths);

  const result: Page[] = [];
  let currentPlacements: Placement[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  let coveredArea = 0;
  const usableArea = usable.width * usable.height;

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const bounds = inkBounds(note);
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) continue;

    const length = lengths[i];
    const t = maxLen === minLen ? 0.5 : (length - minLen) / (maxLen - minLen);
    const eased = Math.sqrt(t);
    const widthFraction = MIN_NOTE_WIDTH_FRACTION + (MAX_NOTE_WIDTH_FRACTION - MIN_NOTE_WIDTH_FRACTION) * eased;

    let w = usable.width * widthFraction;
    let h = w * (bounds.height / bounds.width);

    const maxH = usable.height * 0.34;
    if (h > maxH) {
      h = maxH;
      w = h * (bounds.width / bounds.height);
    }

    // Row wrap.
    if (cursorX + w > usable.width) {
      cursorX = 0;
      cursorY += rowHeight + gutter;
      rowHeight = 0;
    }

    // Page break.
    if (cursorY + h > usable.height || (coveredArea + w * h) / usableArea > COVERAGE_CEILING) {
      if (currentPlacements.length > 0) {
        result.push({ placements: currentPlacements });
      }
      currentPlacements = [];
      cursorX = 0;
      cursorY = 0;
      rowHeight = 0;
      coveredArea = 0;
    }

    const jitter = deterministicUnit(note.id, 7) * (gutter * 0.9) - gutter * 0.45;
    const rotation = deterministicUnit(note.id, 3) * 4 - 2;

    currentPlacements.push({
      note,
      // Baked-in gutter offset — see the Placement.frame doc comment.
      frame: { x: cursorX + usable.x, y: cursorY + jitter + usable.y, width: w, height: h },
      rotation,
    });

    coveredArea += w * h;
    cursorX += w + gutter;
    rowHeight = Math.max(rowHeight, h);
  }

  if (currentPlacements.length > 0) {
    result.push({ placements: currentPlacements });
  }

  return result;
}
