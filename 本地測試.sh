#!/usr/bin/env sh
# 鋒兄宇宙 PV / 本地測試（macOS · Linux）
#
# 用法：
#   本地測試.sh            以預設瀏覽器開啟 index.html（二次元風 PV）
#   本地測試.sh pixel      開啟 pixel.html（像素 MV）
#   本地測試.sh dance      開啟 dance.html（手足舞蹈素材庫）
#   本地測試.sh server     啟動本機伺服器 http://localhost:8788（支援 Range）
set -eu

cd "$(dirname "$0")"

open_url() {
  url="$1"
  if command -v open >/dev/null 2>&1; then            # macOS
    open "$url"
  elif command -v xdg-open >/dev/null 2>&1; then      # Linux
    xdg-open "$url"
  elif command -v sensible-browser >/dev/null 2>&1; then
    sensible-browser "$url"
  else
    echo "  找不到開啟瀏覽器的指令，請手動打開："
    echo "  $url"
  fi
}

PY=""
for c in python3 python; do
  if command -v "$c" >/dev/null 2>&1; then PY="$c"; break; fi
done

case "${1:-}" in
  pixel)
    echo
    echo "  像素 MV"
    echo
    open_url "$PWD/pixel.html"
    ;;
  dance)
    echo
    echo "  手足舞蹈素材庫"
    echo
    open_url "$PWD/dance.html"
    ;;
  server)
    if [ -z "$PY" ]; then
      echo "  找不到 python，改為直接開啟檔案。"
      open_url "$PWD/index.html"
      exit 0
    fi
    echo
    echo "  啟動本機伺服器： http://localhost:8788"
    echo "  結束請按 Ctrl+C"
    echo
    ( sleep 1; open_url "http://localhost:8788/index.html?view=archive" ) &
    exec "$PY" serve.py 8788
    ;;
  *)
    echo
    echo "  鋒兄宇宙 PV / 本地測試"
    echo "  ------------------------------------------------"
    echo "  以預設瀏覽器直接開啟 index.html（二次元風 PV）"
    echo "  （想改用本機伺服器測試： 本地測試.sh server）"
    echo "  （看原本的像素 MV： 本地測試.sh pixel）"
    echo "  （看手足舞蹈素材庫： 本地測試.sh dance）"
    echo
    open_url "$PWD/index.html"
    ;;
esac
