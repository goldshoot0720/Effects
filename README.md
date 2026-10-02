# 鋒兄宇宙 · PIXEL MV

把 9 首歌做成 **90 年代日本 PC-98／賽璐璐風格的像素音樂錄影帶**。
每一首先有自己的故事觀（見 [STORY.md](STORY.md)），動畫再照著故事分鏡生成。

* 線上版：<https://effects-nine.vercel.app>
* 下載版：[Releases](https://github.com/goldshoot0720/Effects/releases)（`.zip` 桌面版 / `.apk` 手機版）

---

## 特色

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

## 操作

| 按鍵 | 功能 | | 按鍵 | 功能 |
|---|---|---|---|---|
| `空白` | 播放 / 暫停 | | `S` | 選歌 |
| `←` `→` | 倒退 / 快進 10 秒 | | `N` `P` | 下一首 / 上一首 |
| `0`–`9` | 跳到 0%–90% | | `Q` | 像素粗細 |
| `F` | 全螢幕 | | `C` | 立繪人偶／手繪賽璐璐 |
| `L` | 角色表（八人齊跳） | | | |

## PV（影片檔）

每首歌都可以輸出成一支 1080p 的 PV（MP4，含音樂），可以直接上傳 B 站／YouTube：

* **片頭（3.6 秒）**：星空夜景＋月亮＋花瓣，彩色粗描邊的像素大標題逐字跳動，
  緞帶寫著標語，這首歌的主角 T-pose 人偶在山丘前跳舞，標語的字直排散在夜空。
* **正片**：原本的故事分鏡，播放器的讀取條換成 PV 四角資訊 ——
  左上曲名、下方 `BPM` ／ `SEC 03 CHORUS` ／時間碼／ `BAR 014 / 040`，外加角框。
* **片尾（8 秒）**：先是一個桌面，主角們以 `鋒兄.pet` 這樣的視窗一個個彈出來謝幕，
  再擦入 `THE END`，八位班底一起跳完最後一段、鞠躬。

```bash
npm i -g playwright            # 或 npm i -D playwright（需要 Chromium 與 ffmpeg）
node tools/render_pv.js                     # 九首全部 → artifacts/pv/PV01_曲名.mp4 + 封面 .png
node tools/render_pv.js s023 s101           # 只做這幾首
node tools/render_pv.js --fps 60 --height 2160   # 60fps / 4K
node tools/render_pv.js --preview s023      # 只輸出幾張 PNG 檢查構圖
```

引擎畫面完全由時間決定，渲染器用 `index.html?pv=<id>` 逐格把 384×216 的像素緩衝區
抓出來，以最近鄰整數倍放大，所以影片裡每顆像素都是方的，而且跟音樂逐格對齊。

## 本機執行

雙擊 **`本地測試.bat`** 用預設瀏覽器打開（`file://`，不需要伺服器）。

想用 HTTP 測試（`serve.py` 有支援 Range，拖曳進度條才正常）：

```bash
本地測試.bat server
```

## 專案結構

```
index.html            主頁面（UI / 樣式）
js/px.js              像素引擎：緩衝區、網點、賽璐璐人物、對話視窗、播放器
js/puppet.js          T-pose 人偶：WebGL2 蒙皮、骨架、舞步（MOVES / ROUTINE）
js/story.js           九首歌的世界觀、色盤、角色表與分鏡
art/cast/<id>.jpg     八位班底的 T-pose 設定圖
data/cast.js          由設定圖切好的身體／手臂圖層與關節位置（data: URI）
STORY.md              故事設定（動畫照這份生成）
data/songs.js         歌曲目錄
data/song/<id>.js     每首歌的歌詞 + 烘焙好的頻譜/節拍資料
audio/<id>.mp3        音檔
tools/build_songs.py  從 mp3 + lrc 產生上面那些資料
tools/build_cast.py   從 art/cast/*.jpg 產生 data/cast.js（需要 numpy、scipy、pillow）
tools/render_pv.js    把每首歌輸出成 PV 影片（需要 playwright、ffmpeg）
serve.py              支援 Range 的小型靜態伺服器
apps/EffectsApp/      Avalonia 桌面版 + Android APP
scripts/build-release.ps1   打包 .zip 與 .apk
```

## 新增一首歌

1. 把 `曲名.mp3` 與 `曲名.lrc` 放到 `%USERPROFILE%\Music`。
2. 在 `tools/build_songs.py` 的 `SONGS` 清單加一行。
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
