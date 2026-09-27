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
| `F` | 全螢幕 | | | |

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
js/story.js           九首歌的世界觀、色盤、角色表與分鏡
STORY.md              故事設定（動畫照這份生成）
data/songs.js         歌曲目錄
data/song/<id>.js     每首歌的歌詞 + 烘焙好的頻譜/節拍資料
audio/<id>.mp3        音檔
tools/build_songs.py  從 mp3 + lrc 產生上面那些資料
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
