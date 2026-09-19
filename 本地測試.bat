@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

if /i "%~1"=="server" goto server

echo.
echo   最瞎結婚理由 - 3D MV / 本地測試
echo   ------------------------------------------------
echo   以預設瀏覽器直接開啟 index.html
echo   ^(想改用本機伺服器測試：在此視窗執行 本地測試.bat server^)
echo.
start "" "%cd%\index.html"
goto end

:server
where python >nul 2>nul
if errorlevel 1 (
  echo   找不到 python，改為直接開啟檔案。
  start "" "%cd%\index.html"
  goto end
)
echo.
echo   啟動本機伺服器： http://localhost:8788
echo   結束請按 Ctrl+C
echo.
start "" "http://localhost:8788/index.html"
python serve.py 8788

:end
endlocal
