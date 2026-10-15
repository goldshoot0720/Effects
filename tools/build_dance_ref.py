"""Build the hand-and-foot dance reference index from the eight cast videos.

The eight grok clips are pose references for the eight cast members: each clip
opens on a T-pose, settles into an A-pose, then walks through a handful of
hand/foot gestures and finally a bust close-up. tools/../art/dance/<id>/ holds
twelve evenly spaced frames per character plus a contact sheet.

This script labels those frames and maps each one onto the choreography in
js/puppet.js (MOVES / ROUTINE), writing data/dance_ref.json for dance.html and
DANCE.md to read.

Usage:  python tools/build_dance_ref.py
"""
import json
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "dance_ref.json")

# frame times the extractor sampled (seconds into each 15.04s clip)
TIMES = [0.2, 1.4, 2.6, 3.8, 5.0, 6.2, 7.4, 8.6, 9.8, 11.0, 12.2, 13.4]

# kind: how the frame is used when authoring a dance
#   calib  - skeleton calibration (T / A pose)
#   base   - neutral standing
#   move   - a hand/foot gesture worth copying into a MOVES entry
#   face   - bust close-up, expression only
# move: the js/puppet.js MOVES entry this frame is the reference for
#   ('-' = no direct entry yet, listed in DANCE.md as a candidate)
CAST = [
    dict(id="whale", name="鯨魚娘", video="grok-video-830ec6ce-ba14-46ca-addd-663868cf295d.mp4",
         note="藍髮鯨魚娘女僕：鰭耳、鯨魚尾、白圍裙。手勢幅度大，適合副歌的揮手與比心。",
         poses=[
             ("calib", "T-pose 雙臂平舉", "-"),
             ("calib", "A-pose 雙臂斜下", "idle"),
             ("base",  "站姿 手自然下垂", "idle"),
             ("move",  "舉手打招呼 單手高舉", "raise"),
             ("move",  "叉腰＋攤手 一手扶腰一手外攤", "-"),
             ("move",  "叉腰＋攤手 換邊", "-"),
             ("move",  "特寫 雙手攤開", "-"),
             ("move",  "特寫 雙手攤開 換邊", "-"),
             ("face",  "特寫 正面", "idle"),
             ("move",  "特寫 豎起拇指", "cheer"),
             ("move",  "特寫 豎起拇指 換邊", "cheer"),
             ("face",  "特寫 眨眼", "idle"),
         ]),
    dict(id="gugu", name="咕咕嘎嘎", video="grok-video-f66fe842-906a-4c2b-b183-db5328f8c722.mp4",
         note="企鵝連帽外套：手多半收在腰側，動作偏小，適合主歌的踏步與拍手。",
         poses=[
             ("calib", "T-pose 雙臂平舉", "-"),
             ("calib", "A-pose 雙臂斜下", "idle"),
             ("base",  "站姿 手自然下垂", "idle"),
             ("move",  "雙手叉腰", "-"),
             ("move",  "雙手叉腰 挺胸", "-"),
             ("move",  "雙手叉腰 側身", "-"),
             ("move",  "單手前指", "point2"),
             ("move",  "雙手叉腰 收下巴", "-"),
             ("face",  "特寫 張嘴", "idle"),
             ("face",  "特寫 正面", "idle"),
             ("face",  "特寫 微笑", "idle"),
             ("move",  "特寫 雙手向前攤開", "wave"),
         ]),
    dict(id="feng", name="鋒兄", video="grok-video-ddc290d0-c501-4f96-a021-44753166fff2.mp4",
         note="卡其飛行外套、眼鏡：真人比例，手勢最清楚，是 point / bow 的主要參考。",
         poses=[
             ("calib", "T-pose 雙臂平舉", "-"),
             ("calib", "A-pose 雙臂斜下", "idle"),
             ("base",  "站姿 手自然下垂", "idle"),
             ("move",  "單手高舉 打招呼", "raise"),
             ("move",  "單手前指 另一手插口袋", "point"),
             ("move",  "單手前指 換邊", "point"),
             ("move",  "說話 雙手自然擺動", "walk"),
             ("move",  "抱拳 雙手合於胸前", "-"),
             ("face",  "特寫 說話", "idle"),
             ("face",  "特寫 正面", "idle"),
             ("face",  "特寫 微笑", "idle"),
             ("move",  "特寫 前指", "point2"),
         ]),
    dict(id="tu", name="塗哥", video="grok-video-da335078-e6b8-4585-9bfe-db6f31f8d18a.mp4",
         note="灰T恤：上半身以攤手與說明手勢為主，適合 ROUTINE 裡的 canon 段落。",
         poses=[
             ("calib", "T-pose 雙臂平舉", "-"),
             ("move",  "雙臂平攤 掌心向上", "wave"),
             ("base",  "站姿 手自然下垂", "idle"),
             ("base",  "站姿 側身", "idle"),
             ("move",  "雙臂平攤 換邊", "wave"),
             ("move",  "雙手在身前比劃", "-"),
             ("move",  "單手前指", "point2"),
             ("move",  "雙手比出手勢", "-"),
             ("face",  "特寫 說話 張嘴", "idle"),
             ("face",  "特寫 說話", "idle"),
             ("face",  "特寫 微笑", "idle"),
             ("face",  "特寫 微笑 換邊", "idle"),
         ]),
    dict(id="bubu", name="喵布布", video="grok-video-f1e8483a-5a1f-4a44-8a60-6119ebcbfbaf.mp4",
         note="三花貓、黑飛行外套：站姿直挺、手指清楚，適合 chuuni 與 point。",
         poses=[
             ("calib", "T-pose 雙臂平舉", "-"),
             ("calib", "A-pose 雙臂斜下", "idle"),
             ("base",  "站姿 手自然下垂", "idle"),
             ("move",  "單手前指", "point"),
             ("move",  "單手前指 換邊", "point"),
             ("base",  "站姿 收手", "idle"),
             ("base",  "站姿 側身", "idle"),
             ("base",  "站姿 雙手垂放", "idle"),
             ("face",  "特寫 正面", "idle"),
             ("face",  "特寫 眨眼", "idle"),
             ("face",  "特寫 張嘴 驚訝", "idle"),
             ("move",  "特寫 豎起拇指", "cheer"),
         ]),
    dict(id="baibai", name="喵白白", video="grok-video-cd03854b-bebd-4a1e-8301-41ef00ca666c.mp4",
         note="白貓、奶油刷毛帽T：姿勢最放鬆，適合躺平與中二病之間的反差。",
         poses=[
             ("calib", "T-pose 雙臂平舉", "-"),
             ("calib", "A-pose 雙臂斜下", "idle"),
             ("base",  "站姿 手自然下垂", "idle"),
             ("move",  "豎起拇指", "cheer"),
             ("move",  "單手攤開", "raise"),
             ("base",  "站姿 側身", "idle"),
             ("move",  "比出勝利手勢", "-"),
             ("move",  "豎起拇指 換邊", "cheer"),
             ("face",  "特寫 正面", "idle"),
             ("face",  "特寫 比出勝利手勢", "-"),
             ("face",  "特寫 微笑", "idle"),
             ("face",  "特寫 收下巴", "idle"),
         ]),
    dict(id="ya", name="牙妹", video="grok-video-f71ec65c-1c43-4e91-9401-ce81e1b7d6a9.mp4",
         note="紅髮雙馬尾＋貓耳：雙手掌心向前推的姿勢最搶眼，適合副歌高潮。",
         poses=[
             ("calib", "T-pose 雙臂平舉", "-"),
             ("calib", "A-pose 雙臂斜下", "idle"),
             ("base",  "站姿 手自然下垂", "idle"),
             ("move",  "單手叉腰 撥髮", "-"),
             ("move",  "叉腰＋攤手", "-"),
             ("move",  "叉腰＋攤手 換邊", "-"),
             ("move",  "雙手掌心向前推", "-"),
             ("move",  "雙臂張開", "wave"),
             ("face",  "特寫 正面", "idle"),
             ("move",  "特寫 前指", "point2"),
             ("face",  "特寫 微笑", "idle"),
             ("face",  "特寫 眨眼", "idle"),
         ]),
    dict(id="yu", name="魚妹", video="grok-video-f0b3bb0b-a481-4996-b1ea-cd66974b6a77.mp4",
         note="水手服：手貼胸口與雙手舉起的驚訝姿勢，適合比心與歡呼。",
         poses=[
             ("calib", "T-pose 雙臂平舉", "-"),
             ("calib", "A-pose 雙臂斜下", "idle"),
             ("base",  "站姿 手自然下垂", "idle"),
             ("move",  "單手貼胸口", "heart"),
             ("move",  "單手貼胸口 換邊", "heart"),
             ("move",  "雙手貼胸口", "heart"),
             ("move",  "雙手舉起 驚訝", "cheer"),
             ("move",  "雙手舉起 換邊", "cheer"),
             ("face",  "特寫 正面", "idle"),
             ("move",  "特寫 握拳 打氣", "-"),
             ("move",  "特寫 握拳 換邊", "-"),
             ("face",  "特寫 閉眼微笑", "idle"),
         ]),
]

KIND_NAME = {"calib": "骨架校準", "base": "基本站姿", "move": "手足舞步", "face": "表情特寫"}


def probe(path):
    try:
        out = subprocess.check_output([
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=width,height", "-of", "csv=p=0", path],
            text=True).strip()
        w, h = out.split(",")[:2]
        return int(w), int(h)
    except Exception:
        return 0, 0


def main():
    cast = []
    for c in CAST:
        folder = os.path.join(ROOT, "art", "dance", c["id"])
        poses = []
        for i, (kind, label, move) in enumerate(c["poses"]):
            n = i + 1
            rel = "art/dance/%s/pose_%02d.jpg" % (c["id"], n)
            path = os.path.join(ROOT, rel)
            if not os.path.exists(path):
                continue
            w, h = probe(path)
            poses.append(dict(n=n, file=rel, t=TIMES[i], kind=kind,
                              kindName=KIND_NAME[kind], label=label, move=move,
                              w=w, h=h))
        cast.append(dict(id=c["id"], name=c["name"], video=c["video"], note=c["note"],
                         sheet="art/dance/%s/sheet.jpg" % c["id"], poses=poses))

    data = dict(
        title="鋒兄宇宙 · 手足舞蹈素材庫",
        source="8 支 grok 角色姿勢參考影片（T-pose → A-pose → 手足手勢 → 特寫）",
        frameTimes=TIMES,
        cast=cast,
        totalPoses=sum(len(c["poses"]) for c in cast),
    )
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)

    # the site has to run from file://, where fetch() on a local json is blocked,
    # so ship the same data as a plain script too
    js = os.path.join(ROOT, "data", "dance_ref.js")
    with open(js, "w", encoding="utf-8") as f:
        f.write("/* generated by tools/build_dance_ref.py -- do not edit by hand */\n")
        f.write("window.DANCE_REF = ")
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write(";\n")

    print("wrote %s  (%d characters, %d poses)" % (OUT, len(cast), data["totalPoses"]))
    print("wrote %s" % js)


if __name__ == "__main__":
    main()
