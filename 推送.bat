@echo off
setlocal

set message=%1
if "%message%"=="" set message=速记更新

echo.
echo === 推送更新到网站 ===
echo.

git add -A
git commit -m "%message%"
git push

echo.
echo === 完成！等1分钟刷新网站 https://ai-hang1226.github.io/xuexi-notes/ ===
echo.

pause
