"""GiniUs · one-minute videos that explain the project's articles on inequality in plain language.
Usage:  python3 make_paper_videos.py still <slug> <scene> <t>   (preview frame)
        python3 make_paper_videos.py render [slug ...]          (render; all if no slug)
Reads tools/videos.json; writes media/videos/<slug>.mp4 and media/videos/<slug>.jpg (poster)."""
import json, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1280, 720, 30
BG = (255, 255, 255); BLUE = (26, 95, 168); GOLD = (201, 150, 43); RED = (212, 63, 58)
DK = (40, 44, 52); GR = (110, 115, 125); CREAM = (247, 249, 252)
FD = "/usr/share/fonts/opentype/inter/"
def F(w, s): return ImageFont.truetype(FD + f"Inter-{w}.otf", s)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = Image.open(f"{ROOT}/images/logo_ginius.png").convert("RGBA")
FUND = Image.open(f"{ROOT}/images/funders_micin_aei_eu.png").convert("RGBA")
MUSIC = "/home/claude/video/music.wav"
SITE = "jfmunozrosas.github.io/ginius"
DUR = [6, 10, 10, 15, 11, 8]  # 60 s

def clamp(x, a=0, b=1): return max(a, min(b, x))
def ease(x): x = clamp(x); return 1 - (1 - x) ** 3
def appear(t, t0, d=0.6): return ease((t - t0) / d)
def mix(c, a): return tuple(int(BG[i] + (c[i] - BG[i]) * a) for i in range(3))
def env(t, dur, fi=0.4, fo=0.4): return clamp(min(t / fi if fi else 1, (dur - t) / fo if fo else 1))
def wrap(d, s, f, width):
    words, lines, cur = s.split(), [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if d.textlength(test, font=f) <= width: cur = test
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines
def text(d, xy, s, f, col, a=1, anchor="mm"):
    if a > 0: d.text(xy, s, font=f, fill=mix(col, a), anchor=anchor)
def block(d, x, y, s, f, col, a, width, lh, anchor="la"):
    for i, line in enumerate(wrap(d, s, f, width)):
        text(d, (x, y + i * lh), line, f, col, a, anchor)
    return len(wrap(d, s, f, width))
def paste(img, src, cx, cy, width, a):
    if a <= 0: return
    h = int(src.height * width / src.width)
    im = src.resize((int(width), h), Image.LANCZOS)
    al = im.split()[3].point(lambda v: int(v * a)); im.putalpha(al)
    img.paste(im, (int(cx - width / 2), int(cy - h / 2)), im)
def frame(a):
    img = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 9], fill=mix(BLUE, a)); d.rectangle([0, H - 9, W, H], fill=mix(GOLD, a))
    return img, d
def label(d, s, a, y=70, col=GOLD):
    f = F("Bold", 22); w = d.textlength(s, font=f)
    if a > 0:
        d.rounded_rectangle([W / 2 - w / 2 - 18, y - 20, W / 2 + w / 2 + 18, y + 20], radius=20, fill=mix(col, a))
        text(d, (W / 2, y), s, f, (255, 255, 255), a)
def badges(d, cx, y, items, a, size=24):
    f = F("Bold", size); ws = [d.textlength(s, font=f) + 36 for s in items]; gap = 14
    x = cx - (sum(ws) + gap * (len(ws) - 1)) / 2
    for s, w in zip(items, ws):
        col = GOLD if s.startswith("ABS") else BLUE
        if a > 0:
            d.rounded_rectangle([x, y - size, x + w, y + size], radius=size, fill=mix(col, a))
            text(d, (x + w / 2, y), s, f, (255, 255, 255), a)
        x += w + gap
def corner_logo(img, a): paste(img, LOGO, W - 120, 55, 170, 0.9 * a)

def s0(v, t, dur):
    img, d = frame(e := env(t, dur, 0.5))
    paste(img, LOGO, W / 2, 120, 380, appear(t, 0.1, 0.8) * e)
    text(d, (W / 2, 220), "GiniUs explains our research in one minute", F("SemiBold", 26), GR, appear(t, 0.6) * e)
    f = F("ExtraBold", 40); lines = wrap(d, v["title"], f, 1080); y0 = 330 - (len(lines) - 1) * 26
    for i, ln in enumerate(lines): text(d, (W / 2, y0 + i * 52), ln, f, BLUE, appear(t, 1.1 + 0.15 * i) * e)
    yj = y0 + len(lines) * 52 + 40
    text(d, (W / 2, yj), f"{v['journal']} ({v['year']})", ImageFont.truetype(FD + "Inter-SemiBoldItalic.otf", 30), DK, appear(t, 2.0) * e)
    badges(d, W / 2, yj + 58, v.get("quality", []), appear(t, 2.3) * e)
    block(d, W / 2, yj + 105, v["authors"], F("Medium", 26), GR, appear(t, 2.7) * e, 1100, 34, "ma")
    text(d, (W / 2, 690), "JCR: Journal Citation Reports quartile in the year of publication · ABS: Academic Journal Guide rating",
         F("Regular", 17), GR, appear(t, 3.0) * e)
    return img

def s1(v, t, dur):
    img, d = frame(e := env(t, dur)); corner_logo(img, e)
    label(d, "THE QUESTION", appear(t, 0.1) * e, 120)
    f = F("Bold", 48); lines = wrap(d, v["question"], f, 1060); y0 = 360 - (len(lines) - 1) * 33
    for i, ln in enumerate(lines): text(d, (W / 2, y0 + i * 66), ln, f, DK, appear(t, 0.6 + 0.5 * i) * e)
    return img

def s2(v, t, dur):
    img, d = frame(e := env(t, dur)); corner_logo(img, e)
    label(d, "HOW", appear(t, 0.1) * e, 120)
    n = len(v["how"]); cw = 360; gap = 30; x0 = W / 2 - (n * cw + (n - 1) * gap) / 2
    for k, s in enumerate(v["how"]):
        a = appear(t, 0.8 + k * 1.2) * e
        if a <= 0: continue
        x = x0 + k * (cw + gap); dy = (1 - a) * 30
        d.rounded_rectangle([x, 220 + dy, x + cw, 540 + dy], radius=22, fill=mix(CREAM, a), outline=mix((205, 215, 230), a), width=2)
        d.rounded_rectangle([x, 220 + dy, x + cw, 234 + dy], radius=6, fill=mix(BLUE if k % 2 == 0 else GOLD, a))
        text(d, (x + cw / 2, 285 + dy), str(k + 1), F("ExtraBold", 46), BLUE if k % 2 == 0 else GOLD, a)
        f = F("SemiBold", 28); lines = wrap(d, s, f, cw - 50)
        for i, ln in enumerate(lines): text(d, (x + cw / 2, 360 + dy + i * 38), ln, f, DK, a, "ma")
    return img

def s3(v, t, dur):
    img, d = frame(e := env(t, dur)); corner_logo(img, e)
    label(d, v.get("findings_label", "WHAT THEY FOUND"), appear(t, 0.1) * e, 95, BLUE)
    n = len(v["findings"]); y = 170
    for k, s in enumerate(v["findings"]):
        a = appear(t, 0.8 + k * 3.2, 0.8) * e
        f = F("SemiBold", 31); lines = wrap(d, s, f, 870); h = 40 + 44 * len(lines)
        if a > 0:
            dx = (1 - a) * -40
            d.rounded_rectangle([130 + dx, y, W - 130 + dx, y + h], radius=18, fill=mix(CREAM, a))
            d.rectangle([130 + dx, y, 142 + dx, y + h], fill=mix(GOLD, a))
            d.ellipse([165 + dx, y + h / 2 - 24, 213 + dx, y + h / 2 + 24], fill=mix(BLUE, a))
            text(d, (189 + dx, y + h / 2), str(k + 1), F("ExtraBold", 28), (255, 255, 255), a)
            for i, ln in enumerate(lines): text(d, (240 + dx, y + 22 + i * 44), ln, f, DK, a, "la")
        y += h + 22
    return img

def s4(v, t, dur):
    img, d = frame(e := env(t, dur)); corner_logo(img, e)
    label(d, "WHY IT MATTERS", appear(t, 0.1) * e, 120, RED)
    f = F("SemiBold", 40); lines = wrap(d, v["why"], f, 1040); y0 = 370 - (len(lines) - 1) * 28
    for i, ln in enumerate(lines): text(d, (W / 2, y0 + i * 56), ln, f, DK, appear(t, 0.7 + 0.45 * i) * e)
    return img

def s5(v, t, dur):
    img, d = frame(e := env(t, dur, 0.4, 1.2))
    paste(img, LOGO, W / 2, 120, 400, appear(t, 0.1) * e)
    a = appear(t, 0.6) * e
    if a > 0:
        d.rounded_rectangle([W / 2 - 470, 225, W / 2 + 470, 400], radius=24, fill=mix(CREAM, a), outline=mix(BLUE, a), width=3)
        text(d, (W / 2, 275), "Read the full article", F("SemiBold", 30), DK, a)
        text(d, (W / 2, 330), "doi.org/" + v["doi"], F("Bold", 32), BLUE, a)
        text(d, (W / 2, 372), f"{v['journal']} ({v['year']})", ImageFont.truetype(FD + "Inter-MediumItalic.otf", 24), GR, a)
    badges(d, W / 2, 432, v.get("quality", []), appear(t, 0.9) * e, 20)
    text(d, (W / 2, 485), "More videos and tools on inequality: " + SITE, F("SemiBold", 28), DK, appear(t, 1.2) * e)
    paste(img, FUND, W / 2, 575, 520, appear(t, 1.6) * e)
    text(d, (W / 2, 660), "Project PID2022-136235NB-I00 funded by MICIU/AEI/10.13039/501100011033 and by ERDF/EU",
         F("Medium", 19), GR, appear(t, 1.8) * e)
    return img

SCENES = [s0, s1, s2, s3, s4, s5]

def render(v, outdir, tmpdir):
    parts = []
    for i, fn in enumerate(SCENES):
        dur = DUR[i]; out = f"{tmpdir}/{v['slug']}_{i}.mp4"; tmp = out.replace(".mp4", ".tmp.mp4")
        p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                              "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", "24",
                              "-pix_fmt", "yuv420p", tmp], stdin=subprocess.PIPE)
        for k in range(int(dur * FPS)): p.stdin.write(fn(v, k / FPS, dur).tobytes())
        p.stdin.close()
        if p.wait() != 0: raise SystemExit("ffmpeg failed")
        os.replace(tmp, out); parts.append(out)
        if i == 0: fn(v, 3.5, dur).save(f"{outdir}/{v['slug']}.png")
    lst = f"{tmpdir}/{v['slug']}_list.txt"
    open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
    silent = f"{tmpdir}/{v['slug']}_silent.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", silent], check=True)
    final = f"{outdir}/{v['slug']}.mp4"; tmpf = final.replace(".mp4", ".tmp.mp4")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", silent, "-i", MUSIC, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                    "-af", "volume=0.55,afade=t=out:st=57:d=3", "-c:a", "aac", "-b:a", "96k", "-shortest", "-movflags", "+faststart", tmpf], check=True)
    os.replace(tmpf, final)
    im = Image.open(f"{outdir}/{v['slug']}.png").convert("RGB"); im.save(f"{outdir}/{v['slug']}.jpg", quality=85)
    os.remove(f"{outdir}/{v['slug']}.png")

if __name__ == "__main__":
    vids = json.load(open(f"{ROOT}/tools/videos.json"))
    outdir = f"{ROOT}/media/videos"; tmpdir = "/home/claude/ginius_video_tmp"
    os.makedirs(outdir, exist_ok=True); os.makedirs(tmpdir, exist_ok=True)
    if sys.argv[1] == "still":
        v = next(x for x in vids if x["slug"] == sys.argv[2]); i, t = int(sys.argv[3]), float(sys.argv[4])
        SCENES[i](v, t, DUR[i]).save(f"{tmpdir}/still_{v['slug']}_{i}.png")
    else:
        sel = sys.argv[2:] or [v["slug"] for v in vids]
        for v in vids:
            if v["slug"] in sel: render(v, outdir, tmpdir); print("ok", v["slug"])
