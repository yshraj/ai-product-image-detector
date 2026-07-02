#!/usr/bin/env python3
"""Generate TrueKart extension PNG icons — photo + verify mark."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "icons"
SIZES = (16, 48, 128)

INK = (12, 18, 34)         # #0C1222
WHITE = (248, 250, 252)
SLATE = (148, 163, 184)
LIGHT = (226, 232, 240)
MUTED = (203, 213, 225)
EMERALD = (16, 185, 129)


def rounded_bg(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), INK + (255,))
    r = max(3, round(size * 0.219))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=r, fill=255)
    img.putalpha(mask)
    return img


def draw_mark(size: int) -> Image.Image:
    img = rounded_bg(size)
    draw = ImageDraw.Draw(img, "RGBA")
    s = size / 128.0

    frame = (
        round(32 * s), round(38 * s),
        round(96 * s), round(86 * s),
    )
    rad = max(1, round(10 * s))
    draw.rounded_rectangle(frame, radius=rad, fill=WHITE + (255,))

    cx, cy = round(64 * s), round(58 * s)
    r1, r2 = max(1, round(14 * s)), max(1, round(8 * s))
    draw.ellipse((cx - r1, cy - r1, cx + r1, cy + r1), fill=LIGHT + (255,))
    draw.ellipse((cx - r2, cy - r2, cx + r2, cy + r2), fill=SLATE + (255,))

    bar = (round(44 * s), round(78 * s), round(84 * s), round(84 * s))
    draw.rounded_rectangle(bar, radius=max(1, round(3 * s)), fill=MUTED + (255,))

    if size >= 24:
        bx, by = round(88 * s), round(84 * s)
        br = max(2, round(18 * s))
        draw.ellipse((bx - br, by - br, bx + br, by + br), fill=EMERALD + (255,))
        check_w = max(1, round(5 * s))
        draw.line(
            [
                (round(80 * s), round(84 * s)),
                (round(86 * s), round(90 * s)),
                (round(97 * s), round(77 * s)),
            ],
            fill=(255, 255, 255, 255),
            width=check_w,
            joint="curve",
        )
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        icon = draw_mark(size)
        path = OUT / f"icon-{size}.png"
        icon.save(path, format="PNG", optimize=True)
        print(f"  wrote {path.relative_to(ROOT)} ({size}x{size})")


if __name__ == "__main__":
    main()
