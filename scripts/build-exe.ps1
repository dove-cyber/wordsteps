# 一键打包 Windows EXE 安装包(需本机已安装 Node.js 与 npm,首次会下载 Electron ~100MB)
# 输出: desktop/dist/词阶 WordSteps Setup *.exe
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

Write-Host "==> [1/3] 同步 web 到 desktop/www" -ForegroundColor Cyan
node "$root\scripts\sync-web.mjs" desktop/www

Write-Host "==> [2/3] 安装 Electron 依赖(首次较慢)" -ForegroundColor Cyan
Push-Location "$root\desktop"
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install 失败" }

Write-Host "==> [3/3] 执行 electron-builder 打包" -ForegroundColor Cyan
npx electron-builder --win --x64
Pop-Location

Write-Host ""
Write-Host "完成!安装包位于 desktop/dist/ 目录" -ForegroundColor Green
