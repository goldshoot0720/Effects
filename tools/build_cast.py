"""Build the eight regular cast members and the two jackpot guest puppets.

Same idea as INSIDE IDENTITY (github.com/goldshoot0720/INSIDEIDENTITY): every
T-pose image is cut out, split into a "body" layer and an "arms" layer (the
strip the arms covered is filled in by vertical interpolation), and handed to
js/puppet.js with joint positions, which skins it to twelve bones.

Everything is written into one script, data/cast.js, as data: URIs. WebGL will
not take a texture from a file:// image, and this site has to run from file://
(and from the offline desktop / Android builds), so the images travel as data.

Usage:  python tools/build_cast.py        (needs numpy, scipy, pillow)
        python tools/build_cast.py claude build one guest and preserve other rigs
        python tools/build_cast.py --debug  also writes build/cast_*.png
"""
import base64
import io
import json
import os
import sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "art", "cast")
OUT_SCALE = 0.5            # textures are stored at half the sheet resolution

# "l" / "r" = screen left / screen right (not the character's own left/right).
# arm: cut = x where the arm leaves the torso, cy = arm centre line,
#      bands = [(x, half_height)] or [(x, top_offset, bottom_offset)]
#      from the fingertips to the shoulder.
# bg:  "flat"    - plain studio backdrop, flood filled from the border
#      polygon   - a photo background: the outline is traced by hand and the
#                  edge band is settled by colour (fg / bg nearest cluster)
CHARS = [
    dict(id="whale", file="whale.png", alpha=True, h=0.9,
         neck=(538, 401), waist=628, pelvis=(538, 875), face=(538, 315), hem=1008,
         l=dict(sh=(408, 472), el=(264, 479), wr=(121, 477), tip=(25, 471),
                hip=(472, 875), knee=(459, 1098), ank=(459, 1312)),
         r=dict(sh=(668, 472), el=(812, 479), wr=(955, 477), tip=(1050, 471),
                hip=(604, 875), knee=(618, 1098), ank=(613, 1312)),
         arm=dict(cut=408, cy=478, padding=1,
                  bands=[(25, -34, 23), (110, -25, 22), (120, -46, 42), (132, -52, 50),
                         (156, -47, 44), (185, -45, 44), (207, -41, 39), (250, -41, 35),
                         (284, -40, 33), (330, -41, 29), (365, -45, 30), (407, -55, 34)]),
         tail=dict(root=(750, 975), tip=(974, 766), minx=855, miny=1012, top=755, bottom=1110)),
    dict(id="gugu", file="gugu.jpg", h=0.88, seeds=[],
         neck=(512, 385), waist=650, pelvis=(510, 800), face=(505, 268), hem=860,
         l=dict(sh=(365, 455), el=(238, 452), wr=(115, 446), tip=(15, 440),
                hip=(435, 820), knee=(432, 1000), ank=(406, 1215)),
         r=dict(sh=(660, 455), el=(786, 452), wr=(909, 446), tip=(1012, 440),
                hip=(585, 820), knee=(584, 1000), ank=(607, 1215)),
         arm=dict(cut=365, cy=450, bands=[(0, 66), (110, 64), (120, 62), (300, 64), (365, 74)])),
    dict(id="feng", file="feng.jpg", h=1.0,
         neck=(505, 265), waist=611, pelvis=(507, 790), face=(507, 190), hem=800,
         l=dict(sh=(364, 355), el=(227, 355), wr=(124, 355), tip=(6, 355),
                hip=(437, 790), knee=(413, 1105), ank=(384, 1420)),
         r=dict(sh=(650, 355), el=(786, 355), wr=(889, 355), tip=(1008, 355),
                hip=(577, 790), knee=(603, 1105), ank=(625, 1420)),
         arm=dict(cut=364, cy=355,
                  bands=[(13, 6), (70, 16), (131, 19), (213, 41), (292, -52, 58),
                         (325, -54, 66), (349, -56, 76), (364, -60, 91)])),
    dict(id="tu", file="tu.jpg", h=0.97,
         neck=(508, 275), waist=614, pelvis=(508, 790), face=(508, 185), hem=805,
         l=dict(sh=(383, 372), el=(240, 372), wr=(131, 372), tip=(8, 372),
                hip=(439, 790), knee=(410, 1103), ank=(372, 1417)),
         r=dict(sh=(633, 372), el=(775, 372), wr=(884, 372), tip=(1008, 372),
                hip=(580, 790), knee=(607, 1103), ank=(636, 1417)),
         arm=dict(cut=383, cy=372,
                  bands=[(15, 7), (75, 16), (139, 18), (225, 28), (308, 49),
                         (350, -61, 56), (368, -70, 62), (377, -74, 74), (383, -76, 90)])),
    dict(id="bubu", file="bubu.jpg", h=0.95,
         polygon=[(410, 192), (455, 238), (505, 244), (555, 238), (606, 192), (604, 262), (612, 305),
                  (602, 362), (610, 400), (612, 428), (700, 440), (858, 452), (962, 460), (1004, 478),
                  (1006, 508), (984, 525), (948, 526), (862, 526), (860, 548), (675, 556), (670, 790),
                  (655, 820), (655, 875), (705, 862), (748, 810), (778, 782), (812, 792), (828, 842),
                  (812, 905), (765, 962), (705, 1000), (660, 996), (664, 1100), (667, 1228), (645, 1250),
                  (650, 1318), (695, 1382), (702, 1426), (566, 1428), (562, 1300), (572, 1252),
                  (562, 1226), (552, 1000), (507, 872), (500, 1000), (462, 1226), (456, 1255),
                  (462, 1300), (462, 1424), (318, 1426), (318, 1400), (348, 1340), (380, 1254),
                  (368, 1228), (362, 1100), (358, 900), (348, 790), (345, 560), (160, 548),
                  (160, 526), (95, 526), (40, 526), (14, 506), (16, 478), (60, 460), (160, 454),
                  (330, 440), (400, 428), (402, 400), (410, 362), (400, 305), (408, 262)],
         neck=(505, 410), waist=650, pelvis=(505, 815), face=(505, 320), hem=845,
         l=dict(sh=(400, 492), el=(280, 496), wr=(130, 494), tip=(14, 492),
                hip=(445, 835), knee=(425, 1040), ank=(415, 1262)),
         r=dict(sh=(610, 492), el=(735, 496), wr=(880, 494), tip=(1006, 492),
                hip=(570, 835), knee=(598, 1040), ank=(612, 1262)),
         arm=dict(cut=392, cy=498, bands=[(0, 42), (150, 42), (160, 62), (392, 72)]),
         tail=dict(root=(655, 945), tip=(805, 815), minx=662, top=770, bottom=1020)),
    dict(id="baibai", file="baibai.jpg", h=0.95,
         polygon=[(434, 132), (482, 172), (540, 176), (600, 170), (650, 130), (652, 214), (645, 282),
                  (640, 322), (690, 358), (740, 368), (950, 392), (1000, 402), (1046, 408), (1066, 428),
                  (1058, 448), (1020, 458), (990, 462), (940, 474), (700, 482), (697, 560), (696, 700),
                  (692, 740), (696, 800), (700, 880), (752, 848), (800, 814), (852, 812), (878, 848),
                  (858, 905), (808, 962), (748, 1000), (702, 1010), (698, 1100), (696, 1175), (690, 1200),
                  (692, 1250), (722, 1318), (726, 1366), (590, 1368), (588, 1212), (576, 1170),
                  (562, 1000), (546, 862), (528, 1000), (498, 1170), (504, 1250), (510, 1362),
                  (348, 1366), (350, 1330), (382, 1262), (408, 1200), (398, 1170), (390, 1100),
                  (382, 1000), (382, 820), (396, 740), (388, 700), (378, 600), (386, 520),
                  (390, 482), (180, 482), (140, 462), (96, 458), (46, 456), (20, 440), (24, 418),
                  (60, 404), (140, 396), (180, 370), (390, 360), (425, 330), (428, 290), (424, 214)],
         neck=(545, 330), waist=620, pelvis=(545, 770), face=(540, 240), hem=805,
         l=dict(sh=(420, 422), el=(285, 424), wr=(140, 430), tip=(20, 432),
                hip=(470, 790), knee=(462, 1010), ank=(452, 1228)),
         r=dict(sh=(670, 422), el=(805, 424), wr=(945, 428), tip=(1066, 428),
                hip=(622, 790), knee=(628, 1010), ank=(648, 1228)),
         arm=dict(cut=404, cy=426, bands=[(0, 40), (150, 42), (170, 64), (404, 66)]),
         tail=dict(root=(700, 950), tip=(860, 830), minx=705, top=790, bottom=1030)),
    dict(id="ya", file="ya.jpg", h=0.92,
         seeds=[(338, 228), (677, 227), (407, 280), (609, 280), (416, 330), (605, 330)],
         neck=(512, 340), waist=590, pelvis=(512, 810), face=(500, 240), hem=862,
         l=dict(sh=(372, 392), el=(230, 392), wr=(88, 395), tip=(12, 395),
                hip=(447, 830), knee=(438, 1050), ank=(436, 1280)),
         r=dict(sh=(652, 392), el=(795, 392), wr=(935, 395), tip=(1012, 395),
                hip=(574, 830), knee=(580, 1050), ank=(581, 1280)),
         arm=dict(cut=372, cy=393, bands=[(0, 27), (286, 27), (292, 58), (372, 58)])),
    dict(id="yu", file="yu.jpg", h=0.95,
         seeds=[(400, 243), (396, 341), (632, 341), (353, 498), (677, 495), (692, 546), (628, 596), (510, 1186)],
         neck=(512, 350), waist=580, pelvis=(512, 815), face=(500, 250), hem=865,
         l=dict(sh=(388, 400), el=(235, 400), wr=(85, 398), tip=(10, 398),
                hip=(455, 835), knee=(458, 1050), ank=(459, 1310)),
         r=dict(sh=(638, 400), el=(790, 400), wr=(940, 398), tip=(1015, 398),
                hip=(570, 835), knee=(562, 1050), ank=(562, 1310)),
         arm=dict(cut=385, cy=402, bands=[(0, 28), (300, 28), (306, 50), (385, 70)])),
]

# Transparent T-pose sheets: keep their supplied alpha (especially GPT's
# white dress) rather than treating pale costume pixels as a white backdrop.
CHARS.extend([
    dict(id="claude", file="claude.png", alpha=True, h=0.95,
         neck=(512, 265), waist=465, pelvis=(512, 640), face=(512, 185), hem=1360,
         l=dict(sh=(365, 330), el=(240, 337), wr=(110, 337), tip=(12, 332),
                hip=(465, 655), knee=(460, 1080), ank=(455, 1450)),
         r=dict(sh=(659, 330), el=(784, 337), wr=(914, 337), tip=(1012, 332),
                hip=(559, 655), knee=(564, 1080), ank=(569, 1450)),
         arm=dict(cut=365, cy=338,
                  bands=[(0, 22), (100, 25), (115, 55), (245, 62), (365, 65)])),
    dict(id="gpt", file="gpt.png", alpha=True, rigid=True, h=0.98,
         neck=(475, 340), waist=575, pelvis=(475, 800), face=(475, 260), hem=1678,
         l=dict(sh=(354, 345), el=(240, 352), wr=(112, 352), tip=(12, 360),
                hip=(455, 670), knee=(455, 1090), ank=(450, 1460)),
         r=dict(sh=(670, 345), el=(784, 352), wr=(912, 352), tip=(1012, 360),
                hip=(569, 670), knee=(569, 1090), ank=(574, 1460)),
         arm=dict(cut=350, cy=355,
                  bands=[(0, 22), (110, 23), (220, 25), (240, 32), (350, 38)])),
])


# ------------------------------------------------------------------ cut out
def cutout_flat(im, seeds=()):
    """Plain light backdrop: flood fill from the border (INSIDE IDENTITY's cutout)."""
    h, w, _ = im.shape
    mx, mn = im.max(2), im.min(2)
    bgish = (mn > 212) & (mx - mn < 22)
    lab, _ = ndimage.label(ndimage.binary_opening(bgish, iterations=2))
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    ids = set(border[border > 0].tolist()) | {int(lab[y, x]) for x, y in seeds if lab[y, x] > 0}
    bg = np.isin(lab, list(ids))
    bg = ndimage.binary_dilation(bg, iterations=2) & bgish
    wsum = ndimage.gaussian_filter(bg.astype(np.float32), 25) + 1e-4
    bgcol = np.stack([ndimage.gaussian_filter(im[..., c] * bg, 25) for c in range(3)], -1) / wsum[..., None]
    dist = np.sqrt(((im - bgcol) ** 2).sum(-1))
    alpha = np.clip(dist / 60.0, 0, 1)
    fg = ~bg
    band = ndimage.binary_dilation(bg, iterations=2) & ndimage.binary_dilation(fg, iterations=2)
    a = np.where(fg, 1.0, 0.0)
    a = np.where(band, np.minimum(alpha, 1.0), a)
    a[bg & ~band] = 0
    a[ndimage.binary_erosion(fg, iterations=2)] = 1.0
    aa = np.maximum(a, 1e-3)[..., None]
    col = np.clip((im - (1 - aa) * bgcol) / aa, 0, 255)
    col = np.where(a[..., None] > 0.999, im, col)
    return col, a


def kmeans(x, k, it=12, seed=1):
    rng = np.random.default_rng(seed)
    c = x[rng.choice(len(x), k, replace=False)]
    for _ in range(it):
        d = ((x[:, None, :] - c[None]) ** 2).sum(-1)
        lab = d.argmin(1)
        for j in range(k):
            m = lab == j
            if m.any():
                c[j] = x[m].mean(0)
    return c


def cutout_polygon(im, poly):
    """Photo backdrop: a hand traced outline, with the edge band decided by colour."""
    h, w, _ = im.shape
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    inside = np.asarray(m) > 127
    R = 14
    core = ndimage.binary_erosion(inside, iterations=R)
    outer = ~ndimage.binary_dilation(inside, iterations=R)
    band = ~core & ~outer
    rng = np.random.default_rng(3)
    lab = im.reshape(-1, 3)
    fgs = lab[core.ravel()]; bgs = lab[(outer & ndimage.binary_dilation(inside, iterations=R * 4)).ravel()]
    fgc = kmeans(fgs[rng.choice(len(fgs), min(len(fgs), 20000), replace=False)], 10)
    bgc = kmeans(bgs[rng.choice(len(bgs), min(len(bgs), 20000), replace=False)], 10)
    px = im[band]
    dfg = ((px[:, None] - fgc[None]) ** 2).sum(-1).min(1)
    dbg = ((px[:, None] - bgc[None]) ** 2).sum(-1).min(1)
    fgp = np.zeros((h, w), np.float32)
    fgp[core] = 1
    fgp[band] = (np.sqrt(dbg) / (np.sqrt(dfg) + np.sqrt(dbg) + 1e-3))
    # trust the traced line a little: the colour vote only wins when it is clear
    prior = ndimage.gaussian_filter(inside.astype(np.float32), 5)
    a = np.clip((fgp * 0.65 + prior * 0.35 - 0.5) * 4 + 0.5, 0, 1)
    a = ndimage.gaussian_filter(a, 0.8)
    a[outer] = 0
    a[core] = 1
    # keep only the figure itself
    solid = a > 0.5
    lab2, n = ndimage.label(solid)
    if n > 1:
        sizes = ndimage.sum(solid, lab2, range(1, n + 1))
        keep = lab2 == (1 + int(np.argmax(sizes)))
        a = np.where(ndimage.binary_dilation(keep, iterations=2), a, 0)
    # fill pinholes inside the body
    a = np.where(ndimage.binary_fill_holes(a > 0.5) & (a < 0.5) & core, 1, a)
    return im, a


def cutout(c):
    if c.get("alpha"):
        return np.asarray(Image.open(os.path.join(SRC, c["file"])).convert("RGBA"))
    im = Image.open(os.path.join(SRC, c["file"])).convert("RGB")
    im = np.asarray(im).astype(np.float32)
    if "polygon" in c:
        col, a = cutout_polygon(im, c["polygon"])
    else:
        col, a = cutout_flat(im, c.get("seeds", []))
    # white shoes on a white backdrop: the flood fill eats them, so they are traced
    for poly in c.get("keep", []):
        m = Image.new("L", (im.shape[1], im.shape[0]), 0)
        ImageDraw.Draw(m).polygon(poly, fill=255)
        m = ndimage.gaussian_filter(np.asarray(m).astype(np.float32) / 255, 1.2)
        a = np.maximum(a, m)
        col = np.where(m[..., None] > 0.5, im, col)
    solid = a > 0.5
    lab2, n = ndimage.label(solid)
    if n > 1:
        sizes = ndimage.sum(solid, lab2, range(1, n + 1))
        keep = np.isin(lab2, 1 + np.where(sizes > 400)[0])
        a = np.where(ndimage.binary_dilation(keep, iterations=3), a, 0)
    return np.dstack([col, a * 255]).astype(np.uint8)


# --------------------------------------------------------- body / arm split
def arm_mask(h, w, cfg, center_x):
    xs = np.arange(w)
    bx = [b[0] for b in cfg["bands"]]
    top = [b[1] if len(b) == 3 else -b[1] for b in cfg["bands"]]
    bottom = [b[-1] for b in cfg["bands"]]
    ys = np.arange(h)[:, None] - cfg["cy"]

    def side(x):
        return ((x < cfg["cut"]) &
                (ys >= np.interp(x, bx, top)) &
                (ys <= np.interp(x, bx, bottom)))

    mask = side(xs) | side(2 * center_x - xs)
    grown = mask.copy()
    for d in range(1, cfg.get("padding", 3) + 1):
        grown[d:] |= mask[:-d]
        grown[:-d] |= mask[d:]
    return grown


def fill_behind(rgba, mask):
    prem = rgba.astype(np.float32).copy()
    prem[..., :3] *= prem[..., 3:4] / 255.0
    h, w = mask.shape
    for x in range(w):
        col = mask[:, x]
        if not col.any():
            continue
        ys = np.nonzero(col)[0]
        for run in np.split(ys, np.nonzero(np.diff(ys) > 1)[0] + 1):
            a, b = max(run[0] - 2, 0), min(run[-1] + 2, h - 1)
            top, bot = prem[a, x], prem[b, x]
            if top[3] < 128 or bot[3] < 128:
                prem[a + 2:b - 1, x] = 0
                continue
            t = np.linspace(0, 1, b - a + 1)[:, None]
            prem[a:b + 1, x] = top * (1 - t) + bot * t
    alpha = prem[..., 3:4]
    col = np.where(alpha > 0, prem[..., :3] * 255.0 / np.maximum(alpha, 1e-3), 0)
    return np.clip(np.concatenate([col, alpha], -1), 0, 255).astype(np.uint8)


def split(c, im):
    if c.get("rigid"):
        # A long-sleeved non-T-pose cutout moves as one connected layer.
        return im, np.zeros_like(im)
    h, w, _ = im.shape
    cx = (c["l"]["sh"][0] + c["r"]["sh"][0]) / 2
    m = arm_mask(h, w, c["arm"], cx)
    m &= im[..., 3] > 0
    arms = im.copy()
    arms[..., 3] = np.where(m, im[..., 3], 0)
    body = fill_behind(im, m)
    cfg = c["arm"]
    reach = max(abs(offset) for band in cfg["bands"] for offset in band[1:]) + 30
    zone = np.zeros((h, w), bool)
    y0, y1 = int(cfg["cy"] - reach), int(cfg["cy"] + reach)
    cut = cfg["cut"] + 12
    zone[y0:y1, :cut] = True
    zone[y0:y1, int(2 * cx - cut):] = True
    solid = body[..., 3] > 20
    opened = ndimage.binary_opening(solid, structure=np.ones((7, 7)))
    body[..., 3] = np.where(zone & solid & ~opened, 0, body[..., 3])
    return body, arms


def clean_layer(layer, count):
    """Keep the body or the two sleeves and the soft alpha around their edges."""
    alpha = layer[..., 3]
    labels, components = ndimage.label(alpha > 24, structure=np.ones((3, 3)))
    if not components:
        alpha[:] = 0
        return layer
    sizes = np.bincount(labels.ravel())
    largest = np.argsort(sizes[1:])[-count:] + 1
    keep = ndimage.binary_dilation(np.isin(labels, largest), iterations=2)
    alpha[~keep] = 0
    return layer


# ------------------------------------------------------------------ output
def scaled(v, k):
    if isinstance(v, (list, tuple)):
        return [scaled(x, k) for x in v]
    if isinstance(v, dict):
        return {a: scaled(b, k) for a, b in v.items()}
    return round(v * k, 1) if isinstance(v, (int, float)) else v


def data_uri(arr, size, components):
    resized = Image.fromarray(arr, "RGBA").resize(size, Image.LANCZOS)
    im = Image.fromarray(clean_layer(np.array(resized), components))
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=88, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


def portrait_art(c, im):
    """Save the original head and upper body before splitting off the sleeves."""
    h, w, _ = im.shape
    top = np.flatnonzero(np.any(im[..., 3] > 128, axis=1))[0]
    chest = c["waist"] + (c["pelvis"][1] - c["waist"]) * .2
    half = round((chest - top) * .72 + 32)
    x = c["face"][0]
    left, right = max(0, x - half), min(w, x + half)
    top, bottom = max(0, int(top) - 8), min(h, round(chest + 80))
    pixels = im[top:bottom, left:right]
    size = (round((right - left) * .8), round((bottom - top) * .8))
    return scaled([left, top, right, bottom], OUT_SCALE), data_uri(pixels, size, 1)


def main():
    debug = "--debug" in sys.argv
    only = next((arg for arg in sys.argv[1:] if not arg.startswith("--")), None)
    if only and not any(c["id"] == only for c in CHARS):
        raise SystemExit("Unknown cast id: " + only)
    if debug:
        os.makedirs(os.path.join(ROOT, "build"), exist_ok=True)
    out = {}
    path = os.path.join(ROOT, "data", "cast.js")
    if only and os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            source = f.read().split("window.MV_CAST_ART=", 1)[1].strip().rstrip(";")
            out = json.loads(source)
    for c in CHARS:
        if only and c["id"] != only:
            continue
        im = cutout(c)
        body, arms = split(c, im)
        h, w, _ = im.shape
        k = OUT_SCALE
        size = (round(w * k), round(h * k))
        rig = {key: scaled(v, k) for key, v in c.items()
               if key in ("neck", "waist", "pelvis", "face", "hem", "l", "r", "tail")}
        rig["portraitBox"], rig["portrait"] = portrait_art(c, im)
        rig.update(size=list(size), armCut=round(c["arm"]["cut"] * k, 1), h=c["h"], rigid=bool(c.get("rigid")),
                   body=data_uri(body, size, 1), arms=data_uri(arms, size, 2))
        out[c["id"]] = rig
        if debug:
            Image.fromarray(body, "RGBA").save(os.path.join(ROOT, "build", f"cast_{c['id']}_body.png"))
            Image.fromarray(arms, "RGBA").save(os.path.join(ROOT, "build", f"cast_{c['id']}_arms.png"))
        print("cast", c["id"], size, len(rig["body"]) // 1024, "+", len(rig["arms"]) // 1024, "KB")
    with open(path, "w", encoding="utf-8") as f:
        f.write("// generated by tools/build_cast.py — T-pose puppet art + joints (texture pixels, l = screen left)\n")
        f.write("window.MV_CAST_ART=" + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print("wrote", path, os.path.getsize(path) // 1024, "KB")


if __name__ == "__main__":
    main()
