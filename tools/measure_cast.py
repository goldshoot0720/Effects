"""Measure T-pose sheet landmarks and propose build_cast.py rig values.

Draws a debug overlay so the proposal can be eyeballed, and prints a dict that
can be pasted straight into tools/build_cast.py.

Usage:  python tools/measure_cast.py feng tu whale
"""
import sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = "/Users/feng33/Documents/Effects"


def mask_of(path):
    im = Image.open(path)
    if im.mode in ("RGBA", "LA"):
        a = np.asarray(im)[..., 3]
        rgb = np.asarray(im.convert("RGB")).astype(np.float32)
        return a > 100, rgb
    rgb = np.asarray(im.convert("RGB")).astype(np.float32)
    mx, mn = rgb.max(2), rgb.min(2)
    bgish = (mn > 205) & (mx - mn < 26)
    lab, _ = ndimage.label(ndimage.binary_opening(bgish, iterations=2))
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, list(set(border[border > 0].tolist())))
    fg = ndimage.binary_fill_holes(~bg)
    lab2, n = ndimage.label(fg)
    if n > 1:
        sz = ndimage.sum(fg, lab2, range(1, n + 1))
        fg = lab2 == (1 + int(np.argmax(sz)))
    return fg, rgb


def runs(row):
    idx = np.nonzero(row)[0]
    if len(idx) == 0:
        return []
    return [(int(g[0]), int(g[-1])) for g in np.split(idx, np.nonzero(np.diff(idx) > 1)[0] + 1)]


def run_at(row, x):
    for a, b in runs(row):
        if a <= x <= b:
            return a, b
    return None


def analyse(name, path, hints):
    m, rgb = mask_of(path)
    h, w = m.shape
    ys = np.nonzero(m.any(1))[0]
    xs = np.nonzero(m.any(0))[0]
    top, bot = int(ys.min()), int(ys.max())
    widths = m.sum(1)
    cy = int(np.argmax(widths[:int(h * 0.60)]))

    cx = hints.get("cx")
    if cx is None:
        rr = [r for r in runs(m[bot - 120]) if r[1] - r[0] > 20]
        cx = int(np.mean([(a + b) / 2 for a, b in rr])) if rr else w // 2

    # neck: explicit hint wins (long hair hides the neck on some sheets)
    if hints.get("neck"):
        ny = hints["neck"]
    else:
        head_peak = int(np.argmax(widths[top:cy])) + top
        lo, hi = max(head_peak + 15, top + 10), cy - 20
        if hi - lo < 10:
            lo, hi = top + 10, max(cy - 20, top + 30)
        bw = widths[lo:hi]
        ny = int(lo + np.argmin(bw))
        minw = widths[ny]
        for y in range(ny, hi):
            if widths[y] > minw * 1.7:
                ny = max(ny, y - 12)
                break
    nr = runs(m[ny])
    nx = int((nr[0][0] + nr[-1][1]) / 2)

    # arm cut: walk in from the tip, the column height jumps at the shoulder
    tip_x = int(xs.min())
    if hints.get("cut"):
        cut = hints["cut"]
    else:
        cut = tip_x
        for x in range(tip_x, cx):
            c = np.nonzero(m[cy - 110:cy + 110, x])[0]
            if len(c) == 0:
                continue
            if c[-1] - c[0] > hints["armspan"]:
                cut = x
                break

    # arm bands: half height of the arm run containing cy, smoothed along x
    raw = np.zeros(w)
    for x in range(tip_x, cut):
        seg = np.nonzero(m[max(0, cy - 140):cy + 140, x])[0]
        if len(seg) == 0:
            continue
        seg = seg + max(0, cy - 140)
        g = np.split(seg, np.nonzero(np.diff(seg) > 1)[0] + 1)
        best = min(g, key=lambda s: 0 if s[0] <= cy <= s[-1]
                   else min(abs(s[0] - cy), abs(s[-1] - cy)))
        raw[x] = (best[-1] - best[0]) / 2
    k = max(3, (cut - tip_x) // 30)
    ker = np.ones(2 * k + 1) / (2 * k + 1)
    sm = np.convolve(raw, ker, "same")
    # the arm must be at least as thick as the hand: take a local max so the
    # fingertips and the cuff are not cut in half, and clamp near the shoulder
    span = cut - tip_x
    cap = np.percentile(sm[tip_x:cut][sm[tip_x:cut] > 0], 92) if cut > tip_x else hints["armhalf"]
    bands = []
    for frac in (0.02, 0.18, 0.35, 0.58, 0.80, 0.96):
        x = int(tip_x + frac * span)
        a, b = max(tip_x, x - int(span * .05)), min(cut, x + int(span * .05))
        win = sm[a:b + 1]
        hh = win.max() if len(win) and win.max() > 0 else hints["armhalf"]
        bands.append((x, int(round(min(hh, cap)))))

    # legs
    hip_row = [r for r in runs(m[hints["pelvis"] + 60]) if r[1] - r[0] > 20]
    if len(hip_row) >= 2:
        lc = (hip_row[0][0] + hip_row[0][1]) / 2
        rc = (hip_row[-1][0] + hip_row[-1][1]) / 2
    else:
        lc, rc = cx - 70, cx + 70

    pelvis_y = hints["pelvis"]
    hem = hints["hem"]
    ank_y = bot - hints["ankup"]
    knee_y = int((pelvis_y + ank_y) / 2)
    kr = [r for r in runs(m[knee_y]) if r[1] - r[0] > 20]
    if len(kr) >= 2:
        kx_l = (kr[0][0] + kr[0][1]) / 2
        kx_r = (kr[-1][0] + kr[-1][1]) / 2
    else:
        kx_l, kx_r = lc, rc
    ar = [r for r in runs(m[ank_y]) if r[1] - r[0] > 20]
    if len(ar) >= 2:
        ax_l = (ar[0][0] + ar[0][1]) / 2
        ax_r = (ar[-1][0] + ar[-1][1]) / 2
    else:
        ax_l, ax_r = kx_l, kx_r

    d = dict(
        neck=(nx, ny),
        waist=int(ny + hints["waist"] * (pelvis_y - ny)),
        pelvis=(int(cx), pelvis_y), face=(int(cx), hints["face"]), hem=hem,
        l=dict(sh=(cut, cy), el=(int(tip_x + .62 * (cut - tip_x)), cy),
               wr=(int(tip_x + .33 * (cut - tip_x)), cy), tip=(tip_x, cy),
               hip=(int(lc), pelvis_y), knee=(int(kx_l), knee_y), ank=(int(ax_l), ank_y)),
        r=dict(sh=(int(2 * cx - cut), cy), el=(int(2 * cx - (tip_x + .62 * (cut - tip_x))), cy),
               wr=(int(2 * cx - (tip_x + .33 * (cut - tip_x))), cy),
               tip=(int(2 * cx - tip_x), cy),
               hip=(int(rc), pelvis_y), knee=(int(kx_r), knee_y), ank=(int(ax_r), ank_y)),
        arm=dict(cut=cut, cy=cy, bands=bands),
    )
    if "tail" in hints:
        d["tail"] = hints["tail"]
    return d, m, rgb, (top, bot, cx, cy, cut, tip_x)


def draw(name, path, d, m, rgb, info):
    im = Image.fromarray(rgb.astype(np.uint8)).convert("RGB")
    dr = ImageDraw.Draw(im)
    def dot(p, c, r=7):
        dr.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=c, outline=(0, 0, 0))
    for side, col in (("l", (255, 0, 0)), ("r", (0, 90, 255))):
        s = d[side]
        dr.line([s["sh"], s["el"], s["wr"], s["tip"]], fill=col, width=4)
        dr.line([s["hip"], s["knee"], s["ank"]], fill=(0, 180, 0), width=4)
        for k in ("sh", "el", "wr", "tip"):
            dot(s[k], col, 6)
        for k in ("hip", "knee", "ank"):
            dot(s[k], (0, 180, 0), 6)
    dot(d["neck"], (255, 140, 0), 8)
    dot(d["pelvis"], (160, 0, 200), 8)
    dot(d["face"], (255, 0, 255), 8)
    dr.line([(0, d["hem"]), (im.width, d["hem"])], fill=(255, 200, 0), width=3)
    dr.line([(0, d["waist"]), (im.width, d["waist"])], fill=(0, 200, 200), width=3)
    dr.line([(d["arm"]["cut"], d["arm"]["cy"] - 150), (d["arm"]["cut"], d["arm"]["cy"] + 150)],
            fill=(255, 0, 128), width=3)
    # arm band outline
    for sign in (1, -1):
        pts_top, pts_bot = [], []
        for x, hh in d["arm"]["bands"]:
            xx = x if sign == 1 else 2 * d["pelvis"][0] - x
            pts_top.append((xx, d["arm"]["cy"] - hh))
            pts_bot.append((xx, d["arm"]["cy"] + hh))
        dr.line(pts_top, fill=(255, 255, 0), width=2)
        dr.line(pts_bot, fill=(255, 255, 0), width=2)
    if "tail" in d:
        t = d["tail"]
        dot(t["root"], (255, 0, 128), 9)
        dot(t["tip"], (255, 0, 128), 9)
        dr.line([t["root"], t["tip"]], fill=(255, 0, 128), width=3)
        dr.line([(t["minx"], t["top"]), (t["minx"], t["miny"])], fill=(0, 255, 0), width=3)
    im.save(f"/tmp/rig_{name}.png")
    print("overlay -> /tmp/rig_%s.png" % name)


HINTS = {
    "feng": dict(armspan=170, armhalf=40, ankup=60, pelvis=790, hem=800,
                 face=190, waist=0.66, neck=265, cut=364),
    "tu":   dict(armspan=170, armhalf=40, ankup=60, pelvis=790, hem=805,
                 face=185, waist=0.66, neck=275, cut=383),
    "whale": dict(armspan=150, armhalf=48, ankup=128, pelvis=875, hem=1008,
                  face=315, waist=0.48, neck=401, cut=408,
                  tail=dict(root=(750, 975), tip=(974, 766), minx=855, miny=1012, top=755)),
}

if __name__ == "__main__":
    for name in sys.argv[1:]:
        extension = "png" if name == "whale" else "jpg"
        path = f"{ROOT}/art/cast/{name}.{extension}"
        d, m, rgb, info = analyse(name, path, HINTS[name])
        print("=" * 70)
        print(name, "top/bot/cx/cy/cut/tip =", info)
        print("neck", d["neck"], "waist", d["waist"], "pelvis", d["pelvis"], "face", d["face"],
              "hem", d["hem"])
        print("l", d["l"])
        print("r", d["r"])
        print("arm", d["arm"])
        draw(name, path, d, m, rgb, info)
