# -*- coding: utf-8 -*-
"""Build the site's song data.

For every entry in SONGS this script
  * copies the mp3 into audio/<id>.mp3
  * decodes it with ffmpeg and bakes a spectrum / loudness / onset track
    into data/song/<id>.js (so the page needs no Web Audio API and works
    straight from file://)
  * parses the .lrc into timed lines and guesses the section structure
  * writes the catalogue data/songs.js

Run:  python tools/build_songs.py            (all songs)
      python tools/build_songs.py s029       (just one)
"""
import base64
import json
import os
import re
import shutil
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(os.path.expanduser('~'), 'Music')
SR = 22050
BAND_FPS = 30          # spectrum frames per second
RMS_FPS = 60           # loudness frames per second
NB = 12                # number of log-spaced bands

# id, source stem (without extension), display title, cast line, theme, tagline
SONGS = [
    ('s023', '023_鋒塗力百年夢_中文', '鋒塗力百年夢', '鋒兄 · 塗哥', 'dream', '一張桌 一枝筆 一個百年夢'),
    ('s024', '024_水電進化 Show_中文', '水電進化 Show', '鋒兄 · 塗哥 · 樂團', 'volt', '從水電進化到樂團'),
    ('s026', '026_喵布布本喵掉的毛_中文', '喵布布本喵掉的毛', '喵布布', 'meow', '本喵掉的毛 每一根都有事'),
    ('s027', '027_鋒兄的傳奇人生_中文', '鋒兄的傳奇人生', '鋒兄', 'crown', '從頭獎到榜首 從榜首到總統'),
    ('s028', '028_塗哥水電王子爆紅_中文', '塗哥水電王子爆紅', '塗哥', 'blaze', '水電王子 一夜爆紅'),
    ('s029', '029_最瞎結婚理由_中文', '最瞎結婚理由', '鋒兄 · 小塗 · 牙妹 · 魚妹', 'wed', '一個號碼　兩場婚禮'),
    ('s062', '062_鋒兄進化 Show！🔥_中文', '鋒兄進化 Show！', '鋒兄', 'neon', '進化沒有上限'),
    ('s101', '我與國中畢業紀念冊的對話', '我與國中畢業紀念冊的對話', '鋒兄', 'memo', '翻開那一頁 全部都回來了'),
    ('s102', '統一發票頭獎得主鋒兄威力彩頭獎得主塗哥', '統一發票頭獎得主鋒兄威力彩頭獎得主塗哥',
     '鋒兄 · 塗哥', 'money', '中獎是日常 不是意外'),
]
# a song's .lrc may sit next to the mp3 under a slightly different name
LRC_OVERRIDE = {'s029': '最瞎結婚理由 鋒兄 小塗 牙妹 魚妹'}


def decode(path):
    """mp3 -> mono float32 at SR via ffmpeg."""
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', path, '-vn', '-ac', '1',
         '-ar', str(SR), '-f', 's16le', '-'],
        check=True, stdout=subprocess.PIPE).stdout
    return np.frombuffer(raw, dtype='<i2').astype(np.float32) / 32768.0


def analyse(x):
    dur = len(x) / SR
    win = 1024
    hop = SR / BAND_FPS
    w = np.hanning(win).astype(np.float32)
    frames = max(1, int((len(x) - win) // hop) + 1)
    spec = np.zeros((frames, win // 2 + 1), dtype=np.float32)
    for i in range(frames):
        s = int(i * hop)
        seg = x[s:s + win]
        if len(seg) < win:
            seg = np.pad(seg, (0, win - len(seg)))
        spec[i] = np.abs(np.fft.rfft(seg * w))
    freqs = np.fft.rfftfreq(win, 1 / SR)

    edges = np.geomspace(40, 10000, NB + 1)
    bands = np.zeros((frames, NB), dtype=np.float32)
    for b in range(NB):
        m = (freqs >= edges[b]) & (freqs < edges[b + 1])
        bands[:, b] = spec[:, m].mean(axis=1) if m.any() else spec[:, np.argmin(abs(freqs - edges[b]))]
    bdb = 20 * np.log10(bands + 1e-6)
    lo, hi = np.percentile(bdb, 5), np.percentile(bdb, 99.5)
    bq = (np.clip((bdb - lo) / max(hi - lo, 1e-6), 0, 1) * 255).astype(np.uint8)

    # loudness envelope at RMS_FPS
    n_rms = max(1, int(dur * RMS_FPS))
    step = len(x) / n_rms
    win_r = int(SR / RMS_FPS * 2)
    rms = np.zeros(n_rms, dtype=np.float32)
    for i in range(n_rms):
        s = int(i * step)
        seg = x[s:s + win_r]
        rms[i] = np.sqrt((seg ** 2).mean()) if len(seg) else 0.0
    rq = (np.clip(rms / max(np.percentile(rms, 99), 1e-6), 0, 1) * 255).astype(np.uint8)

    # onsets from spectral flux
    sd = np.diff(np.vstack([spec[0:1], spec]), axis=0)
    flux = np.maximum(sd, 0).sum(axis=1)
    flux = flux / (np.percentile(flux, 99) + 1e-9)
    th = np.convolve(flux, np.ones(20) / 20, mode='same') * 1.6 + 0.12
    onsets = []
    for i in range(2, frames - 2):
        if flux[i] > th[i] and flux[i] == flux[max(0, i - 2):i + 3].max():
            t = round(i / BAND_FPS, 3)
            if not onsets or t - onsets[-1] > 0.12:
                onsets.append(t)

    # tempo: autocorrelation of the flux curve, folded into a musical range
    f0 = flux - flux.mean()
    ac = np.correlate(f0, f0, 'full')[len(f0) - 1:]
    lag_lo, lag_hi = int(BAND_FPS * 60 / 200), int(BAND_FPS * 60 / 55)
    lag = int(np.argmax(ac[lag_lo:lag_hi])) + lag_lo
    bpm = 60 * BAND_FPS / lag
    while bpm > 152:
        bpm /= 2
    while bpm < 68:
        bpm *= 2
    beat0 = onsets[0] if onsets else 0.0

    return {
        'duration': round(dur, 3), 'bandFps': BAND_FPS, 'rmsFps': RMS_FPS,
        'frames': frames, 'bandCount': NB, 'bpm': round(float(bpm), 2),
        'beat0': round(float(beat0), 3), 'onsets': onsets,
        'bands': base64.b64encode(bq.tobytes()).decode(),
        'rms': base64.b64encode(rq.tobytes()).decode(),
    }


def title_core(lines):
    """Longest repeated phrase across lines — usually the hook, used to spot choruses."""
    best = ''
    texts = [l['text'] for l in lines]
    for i, t in enumerate(texts):
        for n in range(len(t), 3, -1):
            if n <= len(best):
                break
            for s in range(0, len(t) - n + 1):
                sub = t[s:s + n]
                if sum(1 for u in texts if sub in u) >= 2:
                    best = sub
                    break
            if len(best) >= n:
                break
    return best


def parse_lrc(path, duration):
    lines = []
    for ln in open(path, encoding='utf-8').read().split('\n'):
        m = re.match(r'^\[(\d+):(\d+(?:\.\d+)?)\](.*)$', ln.strip())
        if m and m.group(3).strip():
            lines.append({'t': round(int(m.group(1)) * 60 + float(m.group(2)), 2),
                          'text': m.group(3).strip()})
    lines.sort(key=lambda l: l['t'])
    # drop duplicate timestamps (some exports repeat a line)
    out = []
    for l in lines:
        if out and abs(l['t'] - out[-1]['t']) < 0.05 and l['text'] == out[-1]['text']:
            continue
        out.append(l)
    lines = out

    counts = {}
    for l in lines:
        counts[l['text']] = counts.get(l['text'], 0) + 1

    # split into phrases on the gaps, then merge short phrases together so a
    # "section" is something the visuals can actually sit on for a while
    phrases, cur = [], [0]
    for i in range(1, len(lines)):
        if lines[i]['t'] - lines[i - 1]['t'] > 2.5:
            phrases.append(cur)
            cur = []
        cur.append(i)
    phrases.append(cur)

    groups, g = [], []
    for pi, ph in enumerate(phrases):
        g += ph
        span = lines[g[-1]]['t'] - lines[g[0]]['t']
        gap = (lines[phrases[pi + 1][0]]['t'] - lines[ph[-1]]['t']) if pi + 1 < len(phrases) else 99
        if (len(g) >= 4 and span >= 12) or gap > 6.0 or pi == len(phrases) - 1:
            groups.append(g)
            g = []
    if g:
        groups.append(g)

    core = title_core(lines)
    sections = []
    for gi, g in enumerate(groups):
        repeated = sum(1 for i in g if counts[lines[i]['text']] > 1)
        hooky = any(core and core in lines[i]['text'] for i in g)
        kind = 'chorus' if (repeated / len(g) >= .5 or hooky) else 'verse'
        if gi == 0 and len(g) <= 3 and not hooky:
            kind = 'hook'
        start = lines[g[0]]['t']
        last = lines[g[-1]]['t']
        nxt = lines[groups[gi + 1][0]]['t'] if gi + 1 < len(groups) else duration
        end = min(last + 6.0, nxt - 0.4, duration)
        sections.append({'kind': kind, 'start': round(start, 2), 'end': round(max(end, last + 1.2), 2)})
        for i in g:
            lines[i]['sec'] = gi
            lines[i]['kind'] = kind

    for i, l in enumerate(lines):
        nxt = lines[i + 1]['t'] if i + 1 < len(lines) else duration
        l['d'] = round(min(max(nxt - l['t'] - 0.08, 0.7), 6.4), 2)
    return lines, sections


def build(only=None):
    os.makedirs(os.path.join(ROOT, 'audio'), exist_ok=True)
    os.makedirs(os.path.join(ROOT, 'data', 'song'), exist_ok=True)
    catalogue = []
    for sid, stem, title, cast, theme, tagline in SONGS:
        if only and sid != only:
            continue
        mp3 = os.path.join(SRC, stem + '.mp3')
        lrc = os.path.join(SRC, LRC_OVERRIDE.get(sid, stem) + '.lrc')
        if not os.path.exists(mp3):
            print('  !! missing mp3:', mp3)
            continue
        dst = os.path.join(ROOT, 'audio', sid + '.mp3')
        if not os.path.exists(dst) or os.path.getsize(dst) != os.path.getsize(mp3):
            shutil.copyfile(mp3, dst)

        print('==', sid, title)
        an = analyse(decode(dst))
        lines, sections = ([], [])
        if os.path.exists(lrc):
            lines, sections = parse_lrc(lrc, an['duration'])
        else:
            print('  !! missing lrc:', lrc)
        data = {
            'id': sid, 'title': title, 'cast': cast, 'theme': theme,
            'tagline': tagline, 'audio': 'audio/%s.mp3' % sid,
            'analysis': an, 'sections': sections, 'lines': lines,
        }
        path = os.path.join(ROOT, 'data', 'song', sid + '.js')
        with open(path, 'w', encoding='utf-8') as f:
            f.write('window.MV_SONG_DATA=window.MV_SONG_DATA||{};\n')
            f.write('window.MV_SONG_DATA[%s]=%s;\n'
                    % (json.dumps(sid), json.dumps(data, ensure_ascii=False, separators=(',', ':'))))
        kinds = {}
        for s in sections:
            kinds[s['kind']] = kinds.get(s['kind'], 0) + 1
        print('   %.1fs  %d lines  %d sections %s  %.1f bpm  %d onsets  %dkB'
              % (an['duration'], len(lines), len(sections), kinds, an['bpm'],
                 len(an['onsets']), os.path.getsize(path) // 1024))
        catalogue.append({'id': sid, 'title': title, 'cast': cast, 'theme': theme,
                          'tagline': tagline, 'dur': an['duration'],
                          'lines': len(lines), 'bpm': an['bpm'],
                          'src': 'data/song/%s.js' % sid, 'audio': 'audio/%s.mp3' % sid})

    if not only:
        with open(os.path.join(ROOT, 'data', 'songs.js'), 'w', encoding='utf-8') as f:
            f.write('window.MV_SONGS=%s;\n'
                    % json.dumps(catalogue, ensure_ascii=False, separators=(',', ':')))
        print('\ncatalogue: %d songs' % len(catalogue))


if __name__ == '__main__':
    build(sys.argv[1] if len(sys.argv) > 1 else None)
