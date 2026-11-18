#!/usr/bin/env python3
"""Compose one ocean scene GIF: the Tulkun whale swimming with koi fish.

Inputs are the animated GIFs the other workflows produce:
  tulkun.gif  (640x280, 48 frames, transparent)  from the `output` branch
  koi-left.gif / koi-right.gif (512x512, 120 frames, transparent) from main

The scene is drawn at low resolution and upscaled with NEAREST so the
whole ocean keeps the same pixel-art look as the fish. The whale bobs,
the koi drift around it, seaweed sways and bubbles rise -- all in one
GIF, so the profile shows one ocean instead of three separate boxes.

Usage:
  compose-ocean.py [--whale PATH] [--koi-left PATH] [--koi-right PATH]
                   [--output PATH] [--width 800] [--height 450]
                   [--frames 24]
Missing inputs are downloaded from the public raw URLs.
"""
import argparse
import math
import os
import random
import sys
import urllib.request

from PIL import Image, ImageDraw

RAW = "https://raw.githubusercontent.com/GeltraxGT/GeltraxGT"
DEFAULTS = {
    "whale": f"{RAW}/output/tulkun/tulkun.gif",
    "koi-left": f"{RAW}/main/koi-left/koi.gif",
    "koi-right": f"{RAW}/main/koi-right/koi.gif",
}


def load_gif(path_or_url, cache_name):
    if os.path.exists(path_or_url):
        return Image.open(path_or_url)
    tmp = f"/tmp/{cache_name}"
    if not os.path.exists(tmp):
        urllib.request.urlretrieve(path_or_url, tmp)
    return Image.open(tmp)


def frames_of(gif):
    out = []
    for i in range(getattr(gif, "n_frames", 1)):
        gif.seek(i)
        out.append(gif.convert("RGBA"))
    return out


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def draw_background(w, h, frame, n_frames, rng):
    """Ocean at low res (w//2, h//2): gradient, god rays, seabed, seaweed, bubbles."""
    lw, lh = w // 2, h // 2
    img = Image.new("RGB", (lw, lh))
    px = img.load()
    top, bottom = (12, 38, 64), (4, 11, 22)
    for y in range(lh):
        c = lerp(top, bottom, y / max(lh - 1, 1))
        for x in range(lw):
            px[x, y] = c
    draw = ImageDraw.Draw(img, "RGBA")
    # god rays from the surface
    for i, (x0, wd, alpha) in enumerate([(40, 26, 26), (150, 14, 18), (260, 34, 22), (370, 18, 16)]):
        sway = math.sin(frame / n_frames * 2 * math.pi + i) * 3
        draw.polygon([(x0 + sway, 0), (x0 + wd + sway, 0),
                      (x0 + wd - 30 + sway, lh), (x0 - 30 + sway, lh)],
                     fill=(140, 195, 230, alpha))
    # seabed mounds
    for cx, cy, rx, ry, col in [(60, lh + 8, 90, 26, (14, 28, 38)),
                                (200, lh + 12, 110, 30, (10, 22, 32)),
                                (350, lh + 8, 100, 26, (14, 28, 38)),
                                (440, lh + 14, 80, 28, (9, 19, 30))]:
        draw.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=col)
    # rocks
    for (x, y, r) in [(30, lh - 14, 9), (120, lh - 10, 7), (300, lh - 16, 10),
                      (390, lh - 10, 6), (230, lh - 8, 5)]:
        draw.ellipse([x - r, y - r, x + r, y - r // 2], fill=(30, 50, 62))
    # seaweed, swaying with the frame
    for i, (x, ht) in enumerate([(18, 46), (52, 30), (140, 54), (180, 36),
                                 (260, 48), (310, 32), (360, 58), (420, 40)]):
        phase = frame / n_frames * 2 * math.pi + i * 1.7
        tip = math.sin(phase) * 5
        pts = []
        for s in range(9):
            t = s / 8
            pts.append((x + math.sin(phase) * 5 * t * t + tip * t, lh - ht * t))
        draw.line(pts, fill=(26, 62, 36), width=3)
        draw.line(pts[:3], fill=(52, 102, 58), width=3)
    # bubbles rising
    for (x0, speed, size, off) in rng:
        y = (lh - ((frame * speed + off) % (lh + 20))) - 10
        x = x0 + math.sin((frame + off) * 0.15) * 3
        draw.ellipse([x - size, y - size, x + size, y + size],
                     outline=(170, 215, 240, 130))
        draw.point((x - size / 2, y - size / 2), fill=(200, 230, 245, 160))
    return img.resize((w, h), Image.NEAREST)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--whale", default=None)
    ap.add_argument("--koi-left", default=None)
    ap.add_argument("--koi-right", default=None)
    ap.add_argument("--output", default="ocean/ocean.gif")
    ap.add_argument("--width", type=int, default=800)
    ap.add_argument("--height", type=int, default=450)
    ap.add_argument("--frames", type=int, default=24)
    args = ap.parse_args()

    whale = frames_of(load_gif(args.whale or DEFAULTS["whale"], "whale.gif"))
    # Erase the tulkun's bottom-left metrics HUD (x 0-260, y 222-280).
    # The whale itself never dips below y=200 there, so only the text goes.
    from PIL import ImageDraw as _ID
    for f in whale:
        _ID.Draw(f).rectangle([0, 222, 260, 280], fill=(0, 0, 0, 0))
    koi_l = frames_of(load_gif(args.koi_left or DEFAULTS["koi-left"], "koi-left.gif"))
    koi_r = frames_of(load_gif(args.koi_right or DEFAULTS["koi-right"], "koi-right.gif"))
    print(f"whale {len(whale)} frames, koi {len(koi_l)}/{len(koi_r)} frames")

    w, h = args.width, args.height
    n = args.frames
    # whale: 640x280 -> 400x175 (0.625x); koi: 512 -> 130 / 100
    whale_frames = [f.resize((400, 175), Image.NEAREST) for f in whale]
    koi_l_frames = [f.resize((130, 130), Image.NEAREST) for f in koi_l]
    koi_r_frames = [f.resize((130, 130), Image.NEAREST) for f in koi_r]
    koi_l_small = [f.resize((100, 100), Image.NEAREST) for f in koi_l]
    koi_r_small = [f.resize((100, 100), Image.NEAREST) for f in koi_r]

    rng = random.Random(7)
    bubbles = [(rng.randint(10, w // 2 - 10), rng.uniform(0.5, 1.4),
                rng.randint(1, 3), rng.randint(0, 200)) for _ in range(16)]

    out = []
    for i in range(n):
        # whale loop is 48 frames; we take every 2nd, koi every 5th of 120
        wi = (i * 2) % len(whale_frames)
        ki = (i * 5) % len(koi_l_frames)
        frame = draw_background(w, h, i, n, bubbles)
        bob = round(5 * math.sin(2 * math.pi * i / n))
        frame.paste(whale_frames[wi], (360, 130 + bob), whale_frames[wi])
        # gold koi, upper left, drifting right
        dx = round(24 * math.sin(2 * math.pi * i / n))
        dy = round(10 * math.sin(2 * math.pi * i / n + 1.2))
        frame.paste(koi_l_frames[ki], (60 + dx, 120 + dy), koi_l_frames[ki])
        # asagi koi, lower right, flipped, drifting left
        fr = koi_r_frames[ki].transpose(Image.FLIP_LEFT_RIGHT)
        frame.paste(fr, (620 - dx, 290 - dy), fr)
        # small gold koi, bottom left
        frame.paste(koi_l_small[ki], (170 - dx, 320 + dy), koi_l_small[ki])
        # small asagi koi, upper right, flipped
        fr2 = koi_r_small[ki].transpose(Image.FLIP_LEFT_RIGHT)
        frame.paste(fr2, (640 + dx, 60 - dy), fr2)
        out.append(frame.convert("P", palette=Image.ADAPTIVE, colors=256))

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    out[0].save(args.output, save_all=True, append_images=out[1:],
                duration=140, loop=0, optimize=True)
    size = os.path.getsize(args.output)
    print(f"wrote {args.output}: {n} frames {w}x{h}, {size/1024:.0f} KB")


if __name__ == "__main__":
    main()
