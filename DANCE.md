# 鋒兄宇宙 · 手足舞蹈素材庫

八支角色姿勢影片抽出來的關鍵格，當作 `js/puppet.js` 編舞（`MOVES` / `ROUTINE`）的參考材料。
每位班底一支影片，開頭是 **T-pose**，接著 **A-pose**、幾個 **手足手勢**，最後收在 **特寫**。

* 瀏覽頁：`dance.html`（淺色素材庫，可依姿勢分類篩選、點開看大圖與對應舞步）
* 抽格檔：`art/dance/<id>/pose_01.jpg` … `pose_12.jpg` ＋ `sheet.jpg`（接觸表）
* 索引：`data/dance_ref.js` / `data/dance_ref.json`（由 `tools/build_dance_ref.py` 產生）

---

## 影片 → 角色對照

| 角色 id | 班底 | 原始影片 | 素材 |
|---|---|---|---|
| `whale` | 鯨魚娘 | `grok-video-830ec6ce-ba14-46ca-addd-663868cf295d.mp4` | [art/dance/whale](art/dance/whale/) |
| `gugu` | 咕咕嘎嘎 | `grok-video-f66fe842-906a-4c2b-b183-db5328f8c722.mp4` | [art/dance/gugu](art/dance/gugu/) |
| `feng` | 鋒兄 | `grok-video-ddc290d0-c501-4f96-a021-44753166fff2.mp4` | [art/dance/feng](art/dance/feng/) |
| `tu` | 塗哥 | `grok-video-da335078-e6b8-4585-9bfe-db6f31f8d18a.mp4` | [art/dance/tu](art/dance/tu/) |
| `bubu` | 喵布布 | `grok-video-f1e8483a-5a1f-4a44-8a60-6119ebcbfbaf.mp4` | [art/dance/bubu](art/dance/bubu/) |
| `baibai` | 喵白白 | `grok-video-cd03854b-bebd-4a1e-8301-41ef00ca666c.mp4` | [art/dance/baibai](art/dance/baibai/) |
| `ya` | 牙妹 | `grok-video-f71ec65c-1c43-4e91-9401-ce81e1b7d6a9.mp4` | [art/dance/ya](art/dance/ya/) |
| `yu` | 魚妹 | `grok-video-f0b3bb0b-a481-4996-b1ea-cd66974b6a77.mp4` | [art/dance/yu](art/dance/yu/) |

抽格：原始 768×1168 / 24fps / 15.04 秒，從 `0.2s` 起每 `1.2s` 取一格，共 **12 格**，
順序固定為 `T-pose → A-pose → 站姿 → 手勢… → 特寫`。八位合計 **96 格**。

---

## 姿勢分類

| 分類 | 用途 | 對應 `MOVES` |
|---|---|---|
| **骨架校準** `calib` | 第 1、2 格（T-pose / A-pose），拿來對 `js/puppet.js` 的 `neutralPose()` 12 根骨骼角度 | `-` / `idle` |
| **基本站姿** `base` | 第 3 格起的放鬆站姿，當 `idle` 的基準 | `idle` |
| **手足舞步** `move` | 真正要抄進編舞的手／腳姿勢 | 見下表 |
| **表情特寫** `face` | 上半身特寫，只用表情（眨眼、張嘴、微笑） | `idle` |

## 姿勢 → 舞步 對照

八支影片裡重複出現、可以直接對到既有舞步的：

| 影片裡的姿勢 | 對應舞步 | 出現在 |
|---|---|---|
| 單手高舉打招呼 | `raise` | whale 04、feng 04、baibai 05 |
| 單手前指 | `point` | feng 05/06、bubu 04/05 |
| 前指（特寫） | `point2` | gugu 07、tu 07、ya 10、feng 12 |
| 雙臂張開 / 攤手 | `wave` | tu 02/05、ya 08、gugu 12 |
| 豎起拇指 | `cheer` | whale 10/11、bubu 12、baibai 04/08 |
| 手貼胸口 | `heart` | yu 04/05/06 |
| 雙手舉起 | `cheer` | yu 07/08 |
| 雙手自然擺動（說話） | `walk` | feng 07 |

**還沒有對應舞步、列為候選的姿勢**（`data/dance_ref.js` 裡 `move` 標成 `-`）：

| 姿勢 | 建議新舞步名 | 出現在 | 說明 |
|---|---|---|---|
| 叉腰＋攤手 | `hip` | whale 05/06、ya 04/05/06 | 一手扶腰、一手外攤，適合主歌的小幅度律動 |
| 雙手叉腰 | `hip2` | gugu 04/05/06/08 | 兩手都收在腰側，挺胸收下巴 |
| 雙手掌心向前推 | `push` | ya 07 | 兩手往前推、掌心朝前，適合副歌爆點 |
| 抱拳（雙手合於胸前） | `salute` | feng 08 | 抱拳行禮，可以接在 `bow` 前面 |
| 比出勝利手勢 | `vsign` | baibai 07/10 | 兩指 V，適合歡呼段 |
| 握拳打氣 | `fist` | yu 10/11 | 雙手握拳在胸前，適合副歌 |
| 單手叉腰撥髮 | `hair` | ya 04 | 過場用的小動作 |

---

## 怎麼用這份材料編舞

1. 開 `dance.html` 挑姿勢：先看分類「手足舞步」，點開大圖，記下 `pose_XX`。
2. 把該姿勢的角度寫進 `js/puppet.js` 的 `MOVES`，回傳 `P({ ... })`（單位是度，關節名見 `neutralPose()`：
   `lu/lf/ru/rf` 是左右上臂／前臂，`lt/ls/rt/rs` 是左右大腿／小腿，`chest/head/pelvis/tail` 是軀幹）。
3. 想排進整首的齊舞，把舞步名加進 `ROUTINE`（八拍一格），需要左右對稱就加 `mirror: true`，
   要輪唱錯拍就加 `canon: 0.5`。
4. 某首歌要用特定舞步，在 `js/story.js` 的分鏡裡寫 `dance: 'hip'`（或 `dance: ['bounce','push']` 逐小節輪）。

> 例：`ya 07` 的「雙手掌心向前推」大概對應 `lu:150, lf:170, ru:210, rf:190, chest:-6`，
> 實際角度還是要對照 `pose_07.jpg` 微調，因為立繪是正面、`puppet.js` 用的是側面為 0 度的骨骼角。

## 重新產生

```bash
# 1. 抽格（需要 ffmpeg；來源影片在 /Volumes/adata/mp4/）
#    見本檔上方的影片對照表，每位 12 格寫進 art/dance/<id>/
# 2. 重建索引
python tools/build_dance_ref.py     # → data/dance_ref.json + data/dance_ref.js
```
