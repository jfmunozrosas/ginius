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
DUR = [5, 8, 8, 12, 13, 8, 6]  # 60 s: title, question, how, findings, key figure, why, end

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


GREEN = (46, 125, 50)
COLS = {"RED": RED, "GOLD": GOLD, "BLUE": BLUE, "GREEN": GREEN, "GR": GR}

def legend(d, items, y, a):
    f = F("SemiBold", 22); ws = [d.textlength(n, font=f) + 46 for n, _ in items]; gap = 26
    x = W / 2 - (sum(ws) + gap * (len(ws) - 1)) / 2
    for (n, c), w in zip(items, ws):
        if a > 0:
            d.rounded_rectangle([x, y - 9, x + 28, y + 9], radius=4, fill=mix(c, a))
            text(d, (x + 38, y), n, f, DK, a, "lm")
        x += w + gap

def fig_lines(img, d, g, t, e):
    x0, x1, y0, y1 = 190, 1090, 500, 175
    xs, ser = g["x"], g["series"]; allv = [v for s_ in ser for v in s_["y"]]
    lo, hi = min(-15, min(allv) - 3), max(allv) + 5
    X = lambda v: x0 + (v - xs[0]) / (xs[-1] - xs[0]) * (x1 - x0)
    Y = lambda v: y0 - (v - lo) / (hi - lo) * (y0 - y1)
    a = appear(t, 0.5) * e; fa = F("Medium", 20)
    for tk in range(int(lo // 10 * 10), int(hi) + 1, 10):
        if tk < lo: continue
        d.line([x0, Y(tk), x1, Y(tk)], fill=mix((225, 230, 238), a), width=1 if tk else 3)
        text(d, (x0 - 14, Y(tk)), f"{tk:+d}%" if tk else "0", fa, GR, a, "rm")
    for v in xs: text(d, (X(v), y0 + 26), f"{v:.1f}", fa, GR, a)
    text(d, ((x0 + x1) / 2, y0 + 58), g["xlab"], F("SemiBold", 21), DK, a)
    for k, s_ in enumerate(ser):
        p = clamp((t - 1.2 - 1.6 * k) / 2.2); c = COLS[s_["col"]]
        if p <= 0: continue
        pts = [(X(xv), Y(yv)) for xv, yv in zip(xs, s_["y"])]
        m = p * (len(pts) - 1); full = int(m); part = m - full
        seg = pts[:full + 1]
        if full < len(pts) - 1:
            (ax, ay), (bx, by) = pts[full], pts[full + 1]; seg.append((ax + (bx - ax) * part, ay + (by - ay) * part))
        d.line(seg, fill=mix(c, e), width=6, joint="curve")
        for q in seg[:full + 1]: d.ellipse([q[0] - 7, q[1] - 7, q[0] + 7, q[1] + 7], fill=mix(c, e))
    legend(d, [(s_["name"], COLS[s_["col"]]) for s_ in ser], 150, appear(t, 0.8) * e)
    ca = appear(t, 6.5) * e
    if ca > 0 and g.get("callout"):
        px, py = X(xs[0]), Y(ser[0]["y"][0])
        d.ellipse([px - 16, py - 16, px + 16, py + 16], outline=mix(RED, ca), width=4)
        f = F("Bold", 26); w = d.textlength(g["callout"], font=f)
        d.rounded_rectangle([px + 30, py - 22, px + 60 + w, py + 22], radius=12, fill=mix(RED, ca))
        text(d, (px + 45, py), g["callout"], f, (255, 255, 255), ca, "lm")

def fig_bars(img, d, g, t, e):
    x0, x1, y0, y1 = 200, 1080, 500, 185
    lo, hi = g["ymin"], g["ymax"]; Y = lambda v: y0 - (v - lo) / (hi - lo) * (y0 - y1)
    a = appear(t, 0.5) * e; fa = F("Medium", 20); unit = g.get("unit", "")
    step = 10 if hi - lo > 30 else 5
    for tk in range(lo, hi + 1, step):
        d.line([x0, Y(tk), x1, Y(tk)], fill=mix((225, 230, 238), a), width=1)
        text(d, (x0 - 14, Y(tk)), f"{tk}{unit}", fa, GR, a, "rm")
    gs, ser = g["groups"], g["series"]; gw = (x1 - x0) / len(gs); bw = min(110, gw * 0.7 / len(ser))
    for i, gname in enumerate(gs):
        cx = x0 + gw * (i + 0.5)
        text(d, (cx, y0 + 30), gname, F("SemiBold", 24), DK, a)
        for k, s_ in enumerate(ser):
            p = ease((t - 1.0 - 0.5 * i - 0.25 * k) / 1.2) * e
            if p <= 0: continue
            v = s_["y"][i]; bx = cx - len(ser) * bw / 2 + k * bw
            top = Y(lo + (v - lo) * p)
            d.rounded_rectangle([bx + 6, top, bx + bw - 6, y0], radius=6, fill=mix(COLS[s_["col"]], e))
            if p > 0.95: text(d, (bx + bw / 2, top - 18), f"{v:g}{unit}", F("Bold", 22), COLS[s_["col"]], e)
    if "ref" in g:
        ra = appear(t, 3.5) * e
        if ra > 0:
            yr = Y(g["ref"])
            for xx in range(x0, x1, 24): d.line([xx, yr, xx + 13, yr], fill=mix(DK, ra), width=3)
            text(d, (x1 + 8, yr), g.get("reflab", ""), F("Bold", 20), DK, ra, "lm")
    legend(d, [(s_["name"], COLS[s_["col"]]) for s_ in ser], 150, appear(t, 0.8) * e)

def fig_grid(img, d, g, t, e):
    cx0, cw, rh, top = 470, 360, 135, 200
    a = appear(t, 0.5) * e
    for j, c in enumerate(g["cols"]):
        text(d, (cx0 + j * (cw + 20) + cw / 2, top - 30), c, F("Bold", 25), BLUE, a)
    for i, r in enumerate(g["rows"]):
        y = top + i * (rh + 20); ra = appear(t, 1.0 + 2.2 * i) * e
        block(d, 120, y + rh / 2 - 20, r["name"], F("Bold", 26), DK, ra, 320, 34)
        for j, (sym, lab, col) in enumerate(r["cells"]):
            ca = appear(t, 1.6 + 2.2 * i + 0.8 * j) * e
            if ca <= 0: continue
            x = cx0 + j * (cw + 20); c = COLS[col]
            d.rounded_rectangle([x, y, x + cw, y + rh], radius=18, fill=mix(CREAM, ca), outline=mix(c, ca), width=4)
            text(d, (x + 70, y + rh / 2), sym, F("ExtraBold", 72), c, ca)
            block(d, x + 130, y + rh / 2 - (17 if len(lab) > 16 else 0), lab, F("Bold", 28), c, ca, cw - 150, 34, "lm")

def fig_links(img, d, g, t, e):
    top = 180; rh = 82
    for i, (src, dst, sym, lab, col) in enumerate(g["links"]):
        a = appear(t, 0.8 + 2.0 * i) * e
        if a <= 0: continue
        y = top + i * (rh + 14); c = COLS[col]; dx = (1 - a) * -30
        d.rounded_rectangle([110 + dx, y, 470 + dx, y + rh], radius=16, fill=mix(BLUE, a))
        block(d, 290 + dx, y + rh / 2 - (15 if d.textlength(src, font=F("Bold", 24)) > 330 else 0), src, F("Bold", 24), (255, 255, 255), a, 330, 30, "mm")
        d.line([480 + dx, y + rh / 2, 640 + dx, y + rh / 2], fill=mix(c, a), width=6)
        d.polygon([(640 + dx, y + rh / 2 - 14), (664 + dx, y + rh / 2), (640 + dx, y + rh / 2 + 14)], fill=mix(c, a))
        text(d, (560 + dx, y + rh / 2 - 22), sym + " " + lab, F("Bold", 21), c, a)
        d.rounded_rectangle([674 + dx, y, 1170 + dx, y + rh], radius=16, fill=mix(CREAM, a), outline=mix(c, a), width=4)
        block(d, 922 + dx, y + rh / 2 - (15 if d.textlength(dst, font=F("Bold", 25)) > 460 else 0), dst, F("Bold", 25), DK, a, 460, 30, "mm")

def fig_quadrant(img, d, g, t, e):
    x0, x1, y0, y1 = 300, 980, 540, 170; mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    a = appear(t, 0.5) * e
    d.line([x0, y0, x1, y0], fill=mix(DK, a), width=4); d.line([x0, y0, x0, y1], fill=mix(DK, a), width=4)
    d.polygon([(x1, y0 - 10), (x1 + 20, y0), (x1, y0 + 10)], fill=mix(DK, a)); d.polygon([(x0 - 10, y1), (x0, y1 - 20), (x0 + 10, y1)], fill=mix(DK, a))
    text(d, ((x0 + x1) / 2, y0 + 32), "Income  →", F("Bold", 24), DK, a)
    text(d, (x0 - 20, y1 + 10), "Life satisfaction", F("Bold", 24), DK, a, "rm")
    for xx in range(x0 + 10, x1, 22): d.line([xx, my, xx + 11, my], fill=mix((200, 205, 215), a), width=2)
    for yy in range(y1 + 10, y0, 22): d.line([mx, yy, mx, yy + 11], fill=mix((200, 205, 215), a), width=2)
    import random; rnd = random.Random(7)
    pa = appear(t, 1.2, 1.5) * e
    for _ in range(46):
        u = rnd.random(); v_ = clamp(0.15 + 0.7 * u + rnd.gauss(0, 0.12), 0.05, 0.95)
        px, py = x0 + 30 + u * (x1 - x0 - 60), y0 - 20 - v_ * (y0 - y1 - 40)
        d.ellipse([px - 7, py - 7, px + 7, py + 7], fill=mix(GR, pa * 0.8))
    ha = appear(t, 3.5) * e
    if ha > 0:
        d.rounded_rectangle([x0 + 14, y1 + 6, mx - 12, my - 12], radius=18, outline=mix(GOLD, ha), width=5)
        rnd2 = random.Random(3)
        for _ in range(9):
            px = x0 + 50 + rnd2.random() * (mx - x0 - 100); py = y1 + 75 + rnd2.random() * (my - y1 - 105)
            d.ellipse([px - 9, py - 9, px + 9, py + 9], fill=mix(GOLD, ha))
        text(d, ((x0 + mx) / 2, y1 + 34), "HAPPY AND POOR", F("ExtraBold", 26), GOLD, ha)
    la = appear(t, 5.5) * e
    if la > 0:
        f = F("SemiBold", 22); s_ = "Usual pattern: richer, happier"; w = d.textlength(s_, font=f)
        d.rounded_rectangle([x1 - w - 30, y0 - 70, x1 + 10, y0 - 30], radius=10, fill=mix((255, 255, 255), la), outline=mix(GR, la), width=2)
        text(d, (x1 - 10, y0 - 50), s_, f, GR, la, "rm")

def fig_compare(img, d, g, t, e):
    for k, side in enumerate(g["sides"]):
        a = appear(t, 0.6 + 1.0 * k) * e
        if a <= 0: continue
        y = 210 + k * 170; col = BLUE if k == 0 else GOLD
        d.rounded_rectangle([90, y, 330, y + 120], radius=18, fill=mix(col, a))
        block(d, 210, y + 60 - 15, side, F("Bold", 28), (255, 255, 255), a, 220, 32, "mm")
        for j, step in enumerate(g["chain"]):
            sa = appear(t, 1.5 + 1.0 * k + 0.8 * j) * e
            if sa <= 0: continue
            x = 370 + j * 290
            d.rounded_rectangle([x, y + 10, x + 240, y + 110], radius=16, fill=mix(CREAM, sa), outline=mix(col, sa), width=3)
            block(d, x + 120, y + 60 - (15 if d.textlength(step, font=F("SemiBold", 23)) > 210 else 0), step, F("SemiBold", 23), DK, sa, 210, 30, "mm")
            if j < len(g["chain"]) - 1:
                d.polygon([(x + 248, y + 48), (x + 278, y + 60), (x + 248, y + 72)], fill=mix(col, sa))
    text(d, (W / 2, 590), "Which way do the gaps move, and where?", F("Bold", 30), RED, appear(t, 6.0) * e)

FIGS = {"lines": fig_lines, "bars": fig_bars, "grid": fig_grid, "links": fig_links, "quadrant": fig_quadrant, "compare": fig_compare}

def sF(v, t, dur):
    img, d = frame(e := env(t, dur)); corner_logo(img, e); g = v["figure"]
    label(d, g.get("label", "KEY RESULT"), appear(t, 0.1) * e, 52, RED)
    text(d, (W / 2, 102), g["title"], F("ExtraBold", 33), BLUE, appear(t, 0.3) * e)
    FIGS[g["type"]](img, d, g, t, e)
    block(d, W / 2, 652, g["note"], F("Medium", 19), GR, appear(t, 1.0) * e, 1100, 24, "ma")
    return img

SCENES = [s0, s1, s2, s3, sF, s4, s5]

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
