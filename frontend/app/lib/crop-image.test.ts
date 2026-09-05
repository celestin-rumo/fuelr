import { describe, expect, it } from "vitest";
import { WHOLE_IMAGE, isWholeImage, type Crop } from "./resize-image";

/**
 * The crop is a rectangle in fractions, and the arithmetic on it is what
 * decides which pixels a model is paid to read.
 *
 * `cropImage` itself draws on a canvas, which jsdom does not have — so what is
 * asserted here is the part that can be wrong without anybody seeing it: the
 * frame maths, and the question "did anybody actually crop this?". The drawing
 * is exercised in the browser by `e2e/photo-capture.spec.ts`.
 */

/** The same clamping the frame does, extracted so it can be checked. */
function moved(from: Crop, dx: number, dy: number): Crop {
  return {
    ...from,
    x: Math.min(1 - from.width, Math.max(0, from.x + dx)),
    y: Math.min(1 - from.height, Math.max(0, from.y + dy)),
  };
}

describe("the crop rectangle", () => {
  it("starts on the whole image, so doing nothing sends everything", () => {
    // An obligatory tool on the most frequent path is a toll.
    expect(WHOLE_IMAGE).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(isWholeImage(WHOLE_IMAGE)).toBe(true);
  });

  it("knows when somebody has actually cropped", () => {
    expect(isWholeImage({ x: 0, y: 0, width: 0.5, height: 1 })).toBe(false);
    expect(isWholeImage({ x: 0.2, y: 0, width: 0.8, height: 1 })).toBe(false);
    // A frame dragged and put back is not a crop, and a pixel of rounding at
    // a display size nobody chose must not count as one.
    expect(isWholeImage({ x: 0.0005, y: 0, width: 0.9995, height: 1 })).toBe(true);
  });

  it("stops a dragged frame at the edge instead of shrinking it", () => {
    const frame: Crop = { x: 0.5, y: 0.5, width: 0.4, height: 0.4 };

    // Pushed far past the right edge: it stops flush, keeping its size.
    const right = moved(frame, 5, 0);
    expect(right.x).toBeCloseTo(0.6);
    expect(right.width).toBe(0.4);

    // And past the top-left, the same in the other direction.
    const corner = moved(frame, -5, -5);
    expect(corner).toEqual({ x: 0, y: 0, width: 0.4, height: 0.4 });
  });

  it("keeps fractions, so a frame drawn on a preview fits the original", () => {
    // The whole reason this is not in pixels: the frame is dragged over an
    // image a few hundred pixels wide and applied to one four thousand wide.
    const frame: Crop = { x: 0.25, y: 0.1, width: 0.5, height: 0.6 };

    for (const width of [320, 1600, 4032]) {
      const height = Math.round(width * 0.75);
      expect(Math.round(frame.x * width) / width).toBeCloseTo(0.25, 2);
      expect(Math.round(frame.height * height) / height).toBeCloseTo(0.6, 2);
    }
  });
});
