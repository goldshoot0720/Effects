# 四語曲庫來源

依 [NewEffects](https://github.com/goldshoot0720/NewEffects) 匯入 9 首歌曲，
每首皆有中文、英文、日文、粵文，合計 36 版。每版保存獨立 MP3、SRT、
音訊分析與字幕時間；同曲按中、英、日、粵排序，固定歌曲編號 PV01–PV09。

| PV | 歌曲 | 中文 ID | 英文 ID | 日文 ID | 粵文 ID |
|---|---|---|---|---|---|
| 01 | 鋒塗力百年夢 | s023 | s023-en | s023-ja | s023-yue |
| 02 | 水電進化 Show | s024 | s024-en | s024-ja | s024-yue |
| 03 | 喵布布本喵掉的毛 | s026 | s026-en | s026-ja | s026-yue |
| 04 | 鋒兄的傳奇人生 | s027 | s027-en | s027-ja | s027-yue |
| 05 | 塗哥水電王子爆紅 | s028 | s028-en | s028-ja | s028-yue |
| 06 | 最瞎結婚理由 | s029 | s029-en | s029-ja | s029-yue |
| 07 | 鋒兄進化 Show！ | s062 | s062-en | s062-ja | s062-yue |
| 08 | 我與國中畢業紀念冊的對話 | s101 | s101-en | s101-ja | s101-yue |
| 09 | 統一發票頭獎得主鋒兄威力彩頭獎得主塗哥 | s102 | s103 | s104 | s105 |

`data/song_sources.json` 定義來源檔名、語言、故事原曲及 PV 編號。
`data/import-neweffects.json` 記錄來源 repository、checkout revision、來源檔
SHA-256 與是否為尚未提交的工作目錄內容。匯入程式唯讀來源 checkout。
若來源尚未輸出 SRT，僅以該版 `lyrics-<lang>.txt` 與 `timings-<lang>.json`
生成，保留實際重唱與明確略唱紀錄，不借用其他語言的時間。

```powershell
python tools/import_neweffects.py D:\CODE\NewEffects
python tools/build_songs.py
node tools/test_songs.cjs
python tools/test_subtitles.py
```

重建時優先使用已匯入的 `audio/<id>.mp3`，SRT 優先於歷史 LRC，保留字幕的
實際開始、結束與中間空白。可用 `EFFECTS_SONG_SOURCE` 明確指定外部音源覆蓋。
英、日版以原文在上、繁體中文在下顯示。頭獎篇沿用 SRT 的譯文。其他歌曲的譯文由
`data/lyric_translations.json` 依各版字幕順序提供，數字代表同義的中文版歌詞索引（從 0 開始），
文字代表依英、日版補譯的句子。重建時將譯文寫入各句的 `translation` 欄位，沿用原有時間。
所有舊歌曲 ID 保留，因此既有連結不需修改；新增語言版使用 `-en`、`-ja`、`-yue`，
頭獎歌沿用原來的 `s103`、`s104`、`s105`。

舊版頭獎 LRC 留存原始輸入，其 Suno 來源為
[英文](https://suno.com/s/NNjWp4nInpeloTf5)、
[日文](https://suno.com/s/xb8brpvBy23lIyfx)、
[粵文](https://suno.com/s/a0XTF9CAMxLNOtBc)。現行播放使用對應 SRT。
