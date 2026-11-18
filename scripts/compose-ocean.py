#!/usr/bin/env python3
"""Compose one ocean scene GIF: the Tulkun whale swimming with koi fish.

Inputs are the animated GIFs the other workflows produce:
  tulkun.gif  (640x280, 48 frames, transparent)  from the `output` branch
  koi-left.gif / koi-right.gif (512x512, 120 frames, transparent) from main

The scene is drawn at low resolution and upscaled with NEAREST so the
whole ocean keeps the same pixel-art look as the fish.

Motion rules (per the profile owner's direction):
  - The whale holds ONE place and never drifts; only its own tail
    S-wave animates.
  - The koi never circle in place: each one swims straight across the
    scene and wraps off-screen, so the loop is seamless.
  - The seabed is detailed: layered rock ridges, boulders with
    highlights and algae patches, pebbles, and seaweed clusters.

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
    """Detailed ocean at low res (w//2, h//2): gradient, god rays,
    layered rock ridges, boulders with highlights + algae, pebbles,
    seaweed clusters, rising bubbles."""
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
    # --- seabed: back ridge, darker ---
    for cx, cy, rx, ry in [(50, lh + 10, 90, 24), (170, lh + 14, 120, 30),
                           (300, lh + 10, 110, 26), (400, lh + 14, 90, 28)]:
        draw.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(9, 19, 30))
    # --- boulders, left and right corners, with top highlights ---
    boulders = [
        # (cx, cy, r, highlight)
        (18, lh - 6, 26, (52, 78, 92)), (52, lh - 2, 20, (46, 70, 84)),
        (88, lh - 8, 16, (52, 78, 92)),
        (392, lh - 8, 24, (52, 78, 92)), (362, lh - 2, 18, (46, 70, 84)),
        (205, lh - 2, 14, (44, 66, 80)), (300, lh - 4, 12, (44, 66, 80)),
    ]
    for cx, cy, r, hi in boulders:
        draw.ellipse([cx - r, cy - r, cx + r, cy + r // 2], fill=(16, 30, 42))
        draw.arc([cx - r, cy - r, cx + r, cy + r // 2],
                 start=195, end=330, fill=hi)
        # algae patches growing on the boulder
        for ax, ay in [(cx - r // 2, cy - r // 2), (cx + r // 3, cy - r // 3),
                       (cx, cy - r // 2)]:
            draw.ellipse([ax - 2, ay - 2, ax + 2, ay + 2], fill=(34, 84, 46))
    # --- front ridge, slightly lighter, with pebbles ---
    for cx, cy, rx, ry in [(90, lh + 6, 100, 18), (250, lh + 8, 120, 20),
                           (380, lh + 6, 90, 18)]:
        draw.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(13, 26, 38))
    pebble_rng = random.Random(99)
    for _ in range(26):
        x = pebble_rng.randint(4, lw - 4)
        y = pebble_rng.randint(lh - 12, lh - 2)
        r = pebble_rng.randint(1, 3)
        col = pebble_rng.choice([(38, 60, 72), (28, 48, 60), (48, 72, 84)])
        draw.ellipse([x - r, y - r, x + r, y], fill=col)
    # --- seaweed clusters: several blades each, swaying gently ---
    clusters = [(14, 3), (48, 4), (120, 3), (150, 5), (196, 3),
                (238, 4), (282, 3), (330, 5), (368, 4), (404, 3)]
    for ci, (cx, blades) in enumerate(clusters):
        for b in range(blades):
            x = cx + (b - blades // 2) * 5
            ht = 26 + ((ci * 7 + b * 13) % 34)
            phase = frame / n_frames * 2 * math.pi + (ci + b) * 1.3
            green = [(26, 62, 36), (34, 84, 46), (44, 102, 56)][(ci + b) % 3]
            pts = []
            for s in range(9):
                t = s / 8
                pts.append((x + math.sin(phase) * 4 * t * t, lh - ht * t))
            draw.line(pts, fill=green, width=3 if b % 2 == 0 else 2)
            draw.point(pts[-1], fill=(70, 140, 82))
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
    koi_l = frames_of(load_gif(args.koi_left or DEFAULTS["koi-left"], "koi-left.gif"))
    koi_r = frames_of(load_gif(args.koi_right or DEFAULTS["koi-right"], "koi-right.gif"))
    # The koi GIFs draw the fish diagonally (head top-right); rotate -40
    # so the fish swim level, head-first, across the scene.
    koi_l = [f.rotate(-40, resample=Image.NEAREST, fillcolor=(0, 0, 0, 0))
             for f in koi_l]
    koi_r = [f.rotate(-40, resample=Image.NEAREST, fillcolor=(0, 0, 0, 0))
             for f in koi_r]
    # The koi GIF itself swims the fish in a full circle over its 120
    # frames. Use only the level window (frames 112-119, 0-7, where the
    # fish stays near-horizontal) played forward then back, so the fish
    # never dives or loops -- only its tail wiggles.
    def level_window(frames):
        w = [(112 + k) % len(frames) for k in range(16)]
        seq = [frames[j] for j in w] + [frames[j] for j in reversed(w)]
        return seq
    koi_l = level_window(koi_l)
    koi_r = level_window(koi_r)
    print(f"whale {len(whale)} frames, koi {len(koi_l)}/{len(koi_r)} frames")

    # Erase the tulkun's bottom-left metrics HUD (x 0-260, y 222-280).
    # The whale itself never dips below y=200 there, so only the text goes.
    for f in whale:
        ImageDraw.Draw(f).rectangle([0, 222, 260, 280], fill=(0, 0, 0, 0))

    w, h = args.width, args.height
    n = args.frames
    # whale: 640x280 -> 400x175; koi: 512 -> 130 / 100
    whale_frames = [f.resize((400, 175), Image.NEAREST) for f in whale]
    koi_l_frames = [f.resize((130, 130), Image.NEAREST) for f in koi_l]
    koi_r_frames = [f.resize((130, 130), Image.NEAREST) for f in koi_r]
    koi_l_small = [f.resize((100, 100), Image.NEAREST) for f in koi_l]
    koi_r_small = [f.resize((100, 100), Image.NEAREST) for f in koi_r]

    rng = random.Random(7)
    bubbles = [(rng.randint(10, w // 2 - 10), rng.uniform(0.5, 1.4),
                rng.randint(1, 3), rng.randint(0, 200)) for _ in range(16)]

    # The whale holds ONE place: fixed at (360, 130), no bob, no drift.
    WHALE_X, WHALE_Y = 360, 130
    # Each koi swims straight across and wraps off-screen. Its total travel
    # per loop equals its wrap range, so the loop is seamless: at both ends
    # of the loop the fish is fully off-screen. direction +1 = left->right.
    # (frames, size, y_base, start_x, direction, flip, wiggle phase)
    swimmers = [
        (koi_l_frames, 130, 120, -140, +1, False, 0),
        (koi_r_frames, 130, 300, w + 10, -1, True, 9),
        (koi_l_small, 100, 320, 200, +1, False, 17),
        (koi_r_small, 100, 70, w - 200, -1, True, 24),
    ]

    out = []
    for i in range(n):
        # whale loop is 48 frames; we take every 2nd. Koi use the level
        # 32-frame ping-pong sequence (tail wiggle only, no circling).
        wi = (i * 2) % len(whale_frames)
        ki = i % len(koi_l_frames)
        frame = draw_background(w, h, i, n, bubbles)
        frame.paste(whale_frames[wi], (WHALE_X, WHALE_Y), whale_frames[wi])
        for frames, size, y_base, start_x, direction, flip, phase in swimmers:
            span = w + 2 * size
            step = span / n
            x = start_x + direction * step * i
            # wrap into [-size, w] so the fish re-enters off-screen
            x = ((x + size) % span) - size
            y = y_base + round(9 * math.sin(2 * math.pi * i / n + start_x))
            fish = frames[(i + phase) % len(frames)]
            if flip:
                fish = fish.transpose(Image.FLIP_LEFT_RIGHT)
            frame.paste(fish, (round(x), y), fish)
        out.append(frame.convert("P", palette=Image.ADAPTIVE, colors=256))

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    out[0].save(args.output, save_all=True, append_images=out[1:],
                duration=140, loop=0, optimize=True)
    size = os.path.getsize(args.output)
    print(f"wrote {args.output}: {n} frames {w}x{h}, {size/1024:.0f} KB")


if __name__ == "__main__":
    main()
