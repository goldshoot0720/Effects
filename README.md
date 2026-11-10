# 鋒兄宇宙 · PV

Effects 線上首頁預設開啟**鋒兄宇宙音樂影像圖鑑**的歌詞 PV 曲庫，選中 `s102`。曲庫可依歌曲篩選中文、英文、日文、粵語版本並播放二次元 PV。直接開啟 `index.html` 也可離線使用。
角色圖鑑收錄十位角色的全身立繪與三視圖，可拖曳、滑動或按方向鍵切換正面、側面和背面。首頁也可切換到 90 年代 PC-98 像素 MV 或手足舞蹈素材庫。
每一首先有自己的故事觀（見 [STORY.md](STORY.md)）。

曲庫共 **9 首歌曲 × 中文、英文、日文、粵文 = 36 個版本**，依
[NewEffects](https://github.com/goldshoot0720/NewEffects) 的音源與各版獨立校時字幕匯入。
同曲依中、英、日、粵排列，保留 PV01–PV09 歌曲編號，並標示語言；原有歌曲 ID 與網址仍有效。
各版本使用實際音源長度，並非將中文版時長或字幕時間套在其他語言。
人物標籤隨歌曲語言切換：
英文版使用 Feng、Tu、Bu Bu 等英文名，日文版使用フェン、トゥ、ブブ等日文名，
中文與粵語版使用中文名。兩個播放器皆提供上一首、下一首及可記憶的音量控制。
校時字幕位於 `data/lyrics/<id>.srt`；來源檔案與 SHA-256 記錄在 `data/import-neweffects.json`。
完整匯入清單與重建方式見 [字幕資料說明](data/lyrics/README.md)。
英文歌詞保留彩色逐字彈跳、漸層、描邊與陰影，依實際特效字寬增加字距並按單字換行，避免互相擠壓。
播放與輸出畫面的曲名、人物名、字幕及畫面文字移除 Unicode 標點；英文連字號改為單字間隔，
日文長音符與功能圖示保留。原始 SRT、來源歌詞、網址、音檔與字幕時間不修改。
頭獎歌曲四個語言版本由鋒兄、塗哥站雙 C 位，往外安排貓咪與娘角色；
牙妹替換成 Claude 娘、魚妹替換成 GPT 娘，GPT 娘不帶 Sora2 雲朵符號。
人物視窗僅顯示角色名字，不加 `.pet`。其他歌曲仍使用原本的牙妹與魚妹。
新角色素材與產圖規格見 [art/cast/README.md](art/cast/README.md)。

* 線上版：<https://effects-nine.vercel.app/?song=s102#library>（歌詞 PV）· <https://effects-nine.vercel.app/pixel.html>（第二版本 · 像素 MV）
* 下載版：[Releases](https://github.com/goldshoot0720/Effects/releases)（既有 `.zip` 桌面版 / `.apk` 手機版 / `.mp4`；此次曲庫更新不會改寫既有附件）

---

## 第一版本 · 二次元風 PV（index.html）

圖鑑內建二次元 PV 播放器（`js/pv.js`），每首歌一支 **二次元風格的 PV**：原生 1920×1080、
平滑漸層、柔邊立繪（同一套 T-pose 人偶，白色貼紙描邊＋陰影），可以輸出成 MP4 直接上傳 B 站／YouTube。

| 段落 | 畫面 |
|---|---|
| 片頭 | 糖果色粗描邊大標題（每字一色、白色外框、硬陰影、逐字彈出），膠囊標語，主角們在下面跳舞 |
| 主歌 | 兩種輪流：「殘光」式底片條（一格一字、左右兩條）或漫畫對話泡泡（尾巴指著唱的人） |
| 副歌 | 彩色彈跳大字，放射光或舞台聚光燈、紙花，全員齊跳（獨唱的歌會加兩位伴舞） |
| Hook／前奏／尾奏 | 「花束」式星空：主角身邊站著一個裝滿銀河的剪影分身，歌詞直排散落夜空 |
| 間奏 | 桌面上彈出「鋒兄」這樣的角色視窗 |
| 片尾 | 主角們的角色視窗謝幕，再切到 THE END，八位班底一起跳、鞠躬 |

全程有「殘光」式四角 HUD（曲名、`SEC.03  CHORUS`、時間碼、`BAR 020 / 057`、`♩=BPM`），
換段落時是三色斜切的轉場。

**操作**：選一張歌卡開始播放；`空白` 播放／暫停、`←` `→` 倒退／快進 5 秒、`N` `P` 換歌、
`S` 選歌、`0`–`9` 跳段、`F` 全螢幕，拖曳進度條可以跳到任何地方。整首播完自動接下一首。

**輸出成 MP4**（需要 Node 18+、playwright、ffmpeg、Noto Sans CJK 字型）：

```bash
npm i -g playwright
node tools/render_pv.js                 # 全部 36 版 → artifacts/pv/PV01_曲名.mp4 + 封面 .jpg
node tools/render_pv.js s023 s101       # 只做這幾首
node tools/render_pv.js s023-en s023-ja s023-yue  # 只做指定語言
node tools/render_pv.js --list          # 只列計畫，不開始渲染
node tools/render_pv.js --preview s023  # 每個段落各輸出一張 JPG 檢查構圖
```

畫面完全由時間決定，渲染器逐格要畫面再灌進 ffmpeg，所以影片跟音樂逐格對齊。
語言版輸出檔名加上 `_EN`、`_JA`、`_YUE`，避免同曲覆蓋；中文版沒有語言後綴。
推上 `v*` 標籤時，Release 會輸出完整曲庫；手動工作可用 `song_ids` 指定版本。

## 第二版本 · 像素 MV（pixel.html）

* **真的是像素**：整個畫面畫進一塊短邊約 200 邏輯像素的緩衝區，再以整數倍、
  關閉平滑地放大，所以每一條邊都落在一顆方方正正的像素上。
* **4×4 Bayer 網點**：所有漸層都是兩色之間的網點混色，沒有一處用 alpha 漸層 ——
  那個年代的 16 色機器就是這樣做的。
* **賽璐璐人物**：平塗底色 + 一階硬陰影 + 黑描邊，會眨眼、會跟著人聲開合嘴巴。
  八位班底（鯨魚娘、咕咕嘎嘎、鋒兄、塗哥、喵布布、喵白白、牙妹、魚妹）集中在
  `js/story.js` 的角色表，改一處全部的歌跟著換。
* **T-pose 立繪人偶**：參考 [INSIDE IDENTITY](https://github.com/goldshoot0720/INSIDEIDENTITY)，
  八位班底的 T-pose 設定圖（`art/cast/`）切成身體／手臂兩層，綁到 12 根骨骼，
  用 WebGL2 做 2D 蒙皮變形；再以緩衝區解析度、硬邊透明、Bayer 網點量化與黑描邊
  畫回畫面，留在像素風裡。沒有 WebGL2 時自動退回手繪賽璐璐人物（`C` 可手動切換）。
* **舞步**：彈跳、頭頂拍手、指天、中二病 pose、波浪手、踏步、跳躍、比心、歡呼、
  鞠躬、走路、躺平，外加十六小節的完整編舞（含鏡像與輪唱錯拍），全部踩著烘焙好的
  節拍走。每一鏡用 `dance:` 指定，`L` 開角色表看八個人一起跳。
* **故事分鏡**：每首歌 7～12 個分鏡，時間直接對著歌詞與段落走，不是隨機循環的特效。
* **DOS 對話視窗**：歌詞以 `IN：` / `OUT：` 逐字打字出現，兩支儀表每首歌名目不同。
* **字幕以可讀為優先**：實心底板、單色、不描邊。
* **不需要伺服器**：頻譜、音量、節拍都事先算好烘焙進 `data/song/*.js`，
  用 `file://` 直接打開也能完整同步。

### 像素 MV 操作

| 按鍵 | 功能 | | 按鍵 | 功能 |
|---|---|---|---|---|
| `空白` | 播放 / 暫停 | | `S` | 選歌 |
| `←` `→` | 倒退 / 快進 10 秒 | | `N` `P` | 下一首 / 上一首 |
| `0`–`9` | 跳到 0%–90% | | `Q` | 像素粗細 |
| `F` | 全螢幕 | | `C` | 立繪人偶／手繪賽璐璐 |
| `L` | 角色表（八人齊跳） | | | |

## 手足舞蹈素材庫（dance.html）

八支角色姿勢影片抽出來的關鍵格，當作編舞的參考材料。每位班底一支影片：開頭 **T-pose**、
接著 **A-pose**、幾個 **手足手勢**，最後收在 **特寫**。從 `0.2s` 起每 `1.2s` 取一格，共 **12 格**，
八位合計 **96 格**。

* `dance.html`：淺色素材庫，可依姿勢分類（骨架校準／基本站姿／手足舞步／表情特寫）篩選，
  點開看大圖、對應的 `MOVES` 舞步名與影片時間點。
* `art/dance/<id>/`：抽格檔（`pose_01.jpg` … `pose_12.jpg`）＋ `sheet.jpg` 接觸表。
* `data/dance_ref.js`：素材索引，由 `tools/build_dance_ref.py` 從抽格檔掃出來。
* `DANCE.md`：影片→角色對照、姿勢→舞步對照表，以及怎麼把新姿勢寫進 `js/puppet.js`。

```bash
python tools/build_dance_ref.py     # 重建 data/dance_ref.json / .js
```

## 本機執行

雙擊 **`本地測試.bat`** 用預設瀏覽器打開二次元 PV（`file://`，不需要伺服器）；
`本地測試.bat pixel` 打開像素 MV。

想用 HTTP 測試（`serve.py` 有支援 Range，拖曳進度條才正常）：

```bash
本地測試.bat server
```

## 專案結構

```
index.html            首頁：歌詞 PV 曲庫、角色圖鑑與二次元 PV 播放器
pixel.html            首頁第二版本：像素 MV（UI / 樣式）
dance.html            手足舞蹈素材庫：八位班底的姿勢關鍵格瀏覽頁
DANCE.md              素材說明：影片→角色、姿勢→舞步對照與編舞方式
art/dance/<id>/       八支角色姿勢影片抽出的關鍵格（每位 12 格 + 接觸表）
data/dance_ref.js     素材索引（由 tools/build_dance_ref.py 產生）
tools/build_dance_ref.py  掃描 art/dance/ 產生素材索引
js/px.js              像素引擎：緩衝區、網點、賽璐璐人物、對話視窗、播放器
js/puppet.js          T-pose 人偶：WebGL2 蒙皮、骨架、舞步（MOVES / ROUTINE）
js/story.js           九首歌的世界觀、色盤、角色表與分鏡，各語言沿用原曲並依全曲長度調整分鏡
art/cast/            班底與客串角色的 T-pose 設定圖
data/cast.js          由設定圖切好的身體／手臂圖層與關節位置（data: URI）
STORY.md              故事設定（動畫照這份生成）
data/songs.js         歌曲目錄
data/song_sources.json 9 首歌的 36 版來源、語言與固定 PV 編號
data/song/<id>.js     每首歌的歌詞 + 烘焙好的頻譜/節拍資料
audio/<id>.mp3        音檔
tools/build_songs.py  從 mp3 + lrc 產生上面那些資料
tools/build_cast.py   從 art/cast/ 的設定圖產生 data/cast.js（需要 numpy、scipy、pillow）
js/pv.js              二次元風 PV：畫面、播放器、給渲染器的 window.__pv
tools/render_pv.js    把每首歌輸出成 PV 影片（需要 playwright、ffmpeg）
serve.py              支援 Range 的小型靜態伺服器
apps/EffectsApp/      Avalonia 桌面版 + Android APP
scripts/build-release.ps1   打包 .zip 與 .apk
```

## 新增一首歌

1. 把 `曲名.mp3` 與 `曲名.lrc` 放到 `%USERPROFILE%\Music`。
2. 在 `data/song_sources.json` 加一筆（語言版的 `baseId` 指向原曲）。
3. 執行 `python tools/build_songs.py`（需要 `ffmpeg` 與 `numpy`）。
4. 在 `STORY.md` 寫下這首的故事觀，再到 `js/story.js` 加一組分鏡。
   沒有分鏡的歌會落到預設舞台，不會壞掉。

## 桌面版 / 手機版

* **桌面版**：Avalonia + WebView，整個網站打包在執行檔旁邊的 `Web/` 資料夾，離線可用。
* **Android**：單一全螢幕 WebView Activity，網站放在 APK 的 `assets/Web/`，離線可用。

打包（Windows，需要 .NET 8 SDK、JDK 17、Android SDK API 34）：

```bash
pwsh scripts/build-release.ps1 -Version 2.0.0
```

推上 `v*` 標籤時，`.github/workflows/release-apps.yml` 會自動打包並發佈 Release。

> APK 以 debug key 簽章，安裝時 Android 會提示「來源不明」，需要手動允許安裝。

---

音樂與歌詞版權屬原作者（鋒兄 · 塗哥）。
