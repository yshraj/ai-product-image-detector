#!/usr/bin/env python3
"""Generate TrueKart extension PNG icons — flat cart + verify badge (Pillow)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "icons"
SIZES = (16, 48, 128)

TEAL = (15, 118, 110)
TEAL_LIGHT = (204, 251, 241)
WHITE = (255, 255, 255, 255)
ORANGE = (249, 115, 22)


def rounded_bg(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), TEAL + (255,))
    r = max(3, round(size * 0.203))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=r, fill=255)
    img.putalpha(mask)
    return img


def draw_monogram(size: int) -> Image.Image:
    img = rounded_bg(size)
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", round(size * 0.44))
    except OSError:
        font = ImageFont.load_default()
    text = "Tk"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((size - tw) / 2, (size - th) / 2 - 1), text, fill=WHITE, font=font)
    return img


def draw_cart_icon(size: int) -> Image.Image:
    if size <= 20:
        return draw_monogram(size)

    img = rounded_bg(size)
    draw = ImageDraw.Draw(img, "RGBA")
    s = size / 128.0

    basket = [(36 * s, 44 * s), (92 * s, 44 * s), (86 * s, 88 * s), (42 * s, 88 * s)]
    draw.polygon(basket, fill=WHITE)
    draw.arc(
        (48 * s, 28 * s, 80 * s, 52 * s),
        start=200, end=340, fill=WHITE, width=max(2, round(5 * s)),
    )
    draw.line([(48 * s, 44 * s), (44 * s, 44 * s)], fill=WHITE, width=max(2, round(5 * s)))
    draw.line([(80 * s, 44 * s), (84 * s, 44 * s)], fill=WHITE, width=max(2, round(5 * s)))

    wr = max(2, round(7 * s))
    for cx in (52 * s, 76 * s):
        draw.ellipse(
            (cx - wr, 96 * s - wr, cx + wr, 96 * s + wr),
            fill=TEAL_LIGHT + (255,),
        )

    br = max(3, round(16 * s))
    bx, by = 88 * s, 36 * s
    draw.ellipse((bx - br, by - br, bx + br, by + br), fill=ORANGE + (255,))
    check_w = max(2, round(3.5 * s))
    draw.line(
        [(bx - 6 * s, by + 0.5 * s), (bx - 2 * s, by + 4.5 * s), (bx + 7 * s, by - 5.5 * s)],
        fill=WHITE, width=check_w, joint="curve",
    )
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        icon = draw_cart_icon(size)
        path = OUT / f"icon-{size}.png"
        icon.save(path, format="PNG", optimize=True)
        print(f"  wrote {path.relative_to(ROOT)} ({size}x{size})")


if __name__ == "__main__":
    main()
