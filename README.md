# Effects · 鋒兄宇宙 3D MV

把 9 首歌做成一個 **3D 音樂視覺網站**（類似 After Effects 的動態圖像），
同一份內容再包成 **Windows 桌面程式（Avalonia）** 與 **Android APP**。

* 線上版：<https://effects-nine.vercel.app>
* 下載版：[Releases](https://github.com/goldshoot0720/Effects/releases)（`.zip` 桌面版 / `.apk` 手機版）

---

## 特色

* **純 Canvas 2D 自製 3D 引擎**：自己寫的透視攝影機（yaw / pitch / roll、鏡頭晃動、
  段落切換甩鏡），沒有任何前端框架或 3D 函式庫，單檔就能跑。
* **逐字動態字幕**：8 種進場動畫（zoom / drop / slide / flip / burst / spin / wave / type）、
  3D 擠出立體字、動態模糊殘影、色差分離、關鍵字（鋒兄、塗哥、539、頭獎…）自動變色。
* **音樂同步**：每首歌的頻譜、音量包絡、節拍點都在 `tools/build_songs.py` 事先算好並
  烘焙進 `data/song/*.js`，所以 **不需要 Web Audio API、不需要伺服器**，用
  `file://` 直接打開也能完整同步。
* **場景特效**：星空隧道、透視地板網格、環形頻譜、3D 線框多面體、節拍光柱、
  衝擊波環、光暈 bokeh、主題符號粒子、紅線、今彩 539 彩球、囍字彩帶、
  泛光 bloom、暗角、顆粒與電影黑邊。
* **每首歌獨立主題**：9 套配色與符號（婚禮、百年夢、水電、喵、頭獎、爆紅、進化、
  紀念冊、發票）。
* **歌詞校時工具**：按 `E` 進入校時模式，用空白鍵敲點每句開始時間，可匯出 `.lrc`；
  也可以直接把 `.lrc` 拖進畫面套用。
* **手機友善**：長句會自動折行放大（最多 6 行），3D 場景依視窗比例縮放。

## 操作

| 按鍵 | 功能 | | 按鍵 | 功能 |
|---|---|---|---|---|
| `空白` | 播放 / 暫停 | | `S` | 選歌 |
| `←` `→` | 快轉 5 秒 | | `L` | 側邊歌詞 |
| `N` `P` | 下一首 / 上一首 | | `F` | 全螢幕 |
| `E` | 歌詞校時 | | `Q` | 畫質（高 / 中 / 低）|
| `[` `]` | 整首歌詞位移 ±0.1 秒 | | | |

## 本機執行

雙擊 **`本地測試.bat`** 就會用預設瀏覽器打開（`file://`，不需要伺服器）。

想用 HTTP 測試（`serve.py` 有支援 Range，拖曳進度條才正常）：

```bash
本地測試.bat server
```

## 專案結構

```
index.html            主頁面（UI / 樣式）
js/engine.js          3D 引擎、字幕動畫、特效、播放器
data/songs.js         歌曲目錄
data/song/<id>.js     每首歌的歌詞 + 烘焙好的頻譜/節拍資料
audio/<id>.mp3        音檔
tools/build_songs.py  從 mp3 + lrc 產生上面那些資料
serve.py              支援 Range 的小型靜態伺服器
本地測試.bat           一鍵本機測試
apps/EffectsApp/      Avalonia 桌面版 + Android APP
scripts/build-release.ps1   打包 .zip 與 .apk
```

## 新增一首歌

1. 把 `曲名.mp3` 與 `曲名.lrc` 放到 `%USERPROFILE%\Music`。
2. 在 `tools/build_songs.py` 的 `SONGS` 清單加一行（id、檔名、標題、演出者、主題、副標）。
3. 執行：

```bash
python tools/build_songs.py
```

腳本會複製音檔、用 ffmpeg 解碼並分析頻譜／節拍／起音點、解析歌詞並自動判斷
主歌與副歌段落，然後更新 `data/`。（需要 `ffmpeg` 與 `numpy`。）

## 桌面版 / 手機版

* **桌面版**：Avalonia + WebView，把整個網站打包在執行檔旁邊的 `Web/` 資料夾，離線可用。
* **Android**：單一全螢幕 WebView Activity，網站放在 APK 的 `assets/Web/`，離線可用。

打包（Windows，需要 .NET 8 SDK、JDK 17、Android SDK API 34）：

```bash
pwsh scripts/build-release.ps1 -Version 1.0.0
```

產出：

```
artifacts/v1.0.0/Effects-1.0.0-win-x64.zip
artifacts/v1.0.0/Effects-1.0.0.apk
```

推上 `v*` 標籤時，`.github/workflows/release-apps.yml` 也會自動打包並發佈 Release。

> APK 以 debug key 簽章，安裝時 Android 會提示「來源不明」，需要手動允許安裝。

---

音樂與歌詞版權屬原作者（鋒兄 · 塗哥）。
