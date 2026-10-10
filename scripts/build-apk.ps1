# 一键打包 Android APK(调试版)
# 前置要求:
#   1. 已安装 JDK 17(配置 JAVA_HOME)
#   2. 已安装 Android SDK(配置 ANDROID_HOME / ANDROID_SDK_ROOT)
#   3. 本机已安装 Node.js 与 npm
# 输出: mobile/android/app/build/outputs/apk/debug/app-debug.apk
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

Write-Host "==> [1/4] 同步 web 到 mobile/www" -ForegroundColor Cyan
node "$root\scripts\sync-web.mjs" mobile/www

Write-Host "==> [2/4] 安装 Capacitor 依赖" -ForegroundColor Cyan
Push-Location "$root\mobile"
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install 失败" }

Write-Host "==> [3/4] 生成/同步 Android 工程(首次会自动 cap add android)" -ForegroundColor Cyan
if (-not (Test-Path "$root\mobile\android")) {
  npx cap add android
}
npx cap sync android

Write-Host "==> [4/4] 执行 Gradle 构建 APK" -ForegroundColor Cyan
Push-Location "$root\mobile\android"
.\gradlew.bat assembleDebug
Pop-Location
Pop-Location

Write-Host ""
Write-Host "完成!APK 位于 mobile/android/app/build/outputs/apk/debug/app-debug.apk" -ForegroundColor Green
