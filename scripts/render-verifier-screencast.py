#!/usr/bin/env python3
"""Render a terminal-style screencast from REAL captured command output.

Every character shown was produced by actually running the verifier against
the live site. Nothing is typed by hand or reconstructed for effect - if the
output changes, re-capture and re-render rather than editing the text.
"""
import subprocess, sys, os
from PIL import Image, ImageDraw, ImageFont

W, H = 1280, 720
SCALE = 2                      # render at 2x then downsample: crisp text
FPS = 30
PAD = 44
FONT_PATH = "/System/Library/Fonts/SFNSMono.ttf"
SIZE = 15

BG      = (18, 20, 25)
CHROME  = (28, 31, 38)
BORDER  = (46, 51, 61)
FG      = (198, 205, 216)
DIM     = (129, 138, 153)
GREEN   = (78, 201, 154)
RED     = (255, 138, 128)
AMBER   = (224, 179, 85)
BLUE    = (126, 162, 255)
PROMPT  = (126, 162, 255)

font  = ImageFont.truetype(FONT_PATH, SIZE * SCALE)
fontb = ImageFont.truetype(FONT_PATH, SIZE * SCALE)
LH = int(SIZE * 1.55) * SCALE


def colour_for(line: str):
    s = line.strip()
    if s.startswith("VERIFIED") or "match the signed digests" in s or s.startswith("OK "):
        return GREEN
    if "  OK" in line[:8] or s.startswith("OK"):
        return GREEN
    if s.startswith("FAIL") or "does NOT verify" in s or s.startswith("!"):
        return RED
    if s.startswith("Step "):
        return BLUE
    if s.startswith("*") or s.startswith("What this"):
        return DIM
    if s.startswith("$"):
        return PROMPT
    return FG


def frame(lines, cursor=True):
    im = Image.new("RGB", (W * SCALE, H * SCALE), BG)
    d = ImageDraw.Draw(im)
    # window chrome
    d.rectangle([0, 0, W * SCALE, 38 * SCALE], fill=CHROME)
    d.line([0, 38 * SCALE, W * SCALE, 38 * SCALE], fill=BORDER, width=SCALE)
    for i, c in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        cx = (20 + i * 20) * SCALE
        d.ellipse([cx, 13 * SCALE, cx + 11 * SCALE, 24 * SCALE], fill=c)
    d.text((int(W * 0.5) * SCALE, 19 * SCALE), "verify_site_integrity.py",
           font=font, fill=DIM, anchor="mm")

    y = (38 + PAD // 2) * SCALE
    visible = lines[-26:]
    for ln in visible:
        d.text((PAD * SCALE, y), ln, font=font, fill=colour_for(ln))
        y += LH
    if cursor and visible:
        d.rectangle([PAD * SCALE, y, PAD * SCALE + 9 * SCALE, y + 17 * SCALE], fill=DIM)
    return im.resize((W, H), Image.LANCZOS)


def build(src_txt, out_mp4, intro, hold_end=70):
    raw = [l.rstrip("\n") for l in open(src_txt, encoding="utf-8", errors="replace")]
    raw = [l for l in raw if l.strip() != ""]
    # Wrap rather than clip: a truncated sentence in a video about honest
    # claims is a bad look, and the verifier emits long explanatory lines.
    wrapped = []
    for l in raw:
        if len(l) <= 112:
            wrapped.append(l); continue
        indent = " " * (len(l) - len(l.lstrip()))
        cur = ""
        for w in l.split(" "):
            if cur and len(cur) + 1 + len(w) > 112:
                wrapped.append(cur); cur = indent + "  " + w
            else:
                cur = w if not cur else cur + " " + w
        if cur: wrapped.append(cur)
    raw = wrapped

    frames, shown = [], []
    # intro: the command being "typed"
    for i in range(1, len(intro) + 1):
        frames.append(frame(["$ " + intro[:i]]))
    for _ in range(14):
        frames.append(frame(["$ " + intro]))
    shown = ["$ " + intro, ""]

    for ln in raw:
        shown.append(ln)
        f = frame(shown)
        # dwell on the lines that carry the verdict
        n = 9 if ("VERIFIED" in ln or ln.strip().startswith("FAIL")) else 2
        frames.extend([f] * n)
    frames.extend([frame(shown, cursor=False)] * hold_end)

    tmp = out_mp4 + ".frames"
    os.makedirs(tmp, exist_ok=True)
    for i, f in enumerate(frames):
        f.save(f"{tmp}/{i:05d}.png")
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS),
        "-i", f"{tmp}/%05d.png",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26",
        "-preset", "slow", "-movflags", "+faststart",
        "-vf", "scale=1280:720:flags=lanczos", out_mp4,
    ], check=True)
    # poster frame = the verdict
    frames[-1].save(out_mp4.replace(".mp4", ".jpg"), quality=88)
    subprocess.run(["rm", "-rf", tmp], check=False)
    dur = len(frames) / FPS
    print(f"  {out_mp4}  {len(frames)} frames  {dur:.1f}s  "
          f"{os.path.getsize(out_mp4)/1024:.0f} KB")


if __name__ == "__main__":
    build("real-ok.txt", "verify-pass.mp4",
          "python3 verify_site_integrity.py --url https://secure.imagineqira.com")
    build("real-fail.txt", "verify-tamper.mp4",
          "python3 verify_site_integrity.py --manifest tampered.json")
