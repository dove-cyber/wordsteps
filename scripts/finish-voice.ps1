# WordSteps - auto finish after fine-tuning (ASCII only to avoid encoding issues)
# wait for training -> export ONNX(+metadata) -> build tokens -> repack sherpa runtime
#                   -> install into app -> rebuild APK -> preview -> self check
$ErrorActionPreference = "Continue"
$tool = "C:\Users\g67\Documents\deepseek-harness\default-workspace\toolchain"
$ws   = "C:\Users\g67\Documents\deepseek-harness\default-workspace\wordsteps"
$py   = "$tool\tts-venv\Scripts\python.exe"
$node = "C:\Users\g67\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
$log  = "$tool\finish.log"
function Say($m) {
  $t = (Get-Date).ToString("HH:mm:ss")
  Write-Output "[$t] $m"
  Add-Content -Path $log -Value "[$t] $m" -Encoding UTF8
}

Set-Content -Path $log -Value "=== finish start ===" -Encoding UTF8
$env:TEMP = "$tool\tmp"; $env:TMP = "$tool\tmp"
$env:PYTHONIOENCODING = "utf-8"; $env:PYTHONUTF8 = "1"
$env:Path = "$tool\mingw\bin;$env:Path"

# ---------- 1. wait for training ----------
Say "waiting for training process to exit..."
$waited = 0
while (Get-Process python -ErrorAction SilentlyContinue) {
  Start-Sleep -Seconds 60; $waited++
  if ($waited % 20 -eq 0) { Say "  waited $waited min ..." }
}
Say "training finished (waited $waited min)"

# ---------- 2. locate this run's version dir ----------
$ver = Get-ChildItem "$tool\lightning_logs" -Directory -ErrorAction SilentlyContinue |
       Where-Object { $_.Name -like "version_*" } |
       Sort-Object { (Get-ChildItem $_.FullName -Recurse -Filter "*.ckpt" -ErrorAction SilentlyContinue |
                     Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime } -Descending |
       Select-Object -First 1
if (-not $ver) { Say "!! no checkpoint dir found"; exit 1 }
Say "run dir: $($ver.FullName)"

# ---------- 3. export + repack ----------
Say "running finalize (export onnx + metadata + tokens + repack)..."
& $py "$ws\scripts\train\finalize_voice.py" --name anon --logs $ver.FullName `
    --json "$tool\voice-out\anon-ft.json" --out "$tool\voice-out" 2>&1 |
    ForEach-Object { Add-Content -Path $log -Value $_ -Encoding UTF8 }
Say "finalize exit code: $LASTEXITCODE"

$pkg = "$tool\voice-out\sherpa-package"
if (-not (Test-Path "$pkg\sherpa-onnx-wasm-main-tts.data")) { Say "!! voice package not produced"; exit 1 }
$pkgMB = [math]::Round((Get-Item "$pkg\sherpa-onnx-wasm-main-tts.data").Length/1MB, 2)
Say "voice package data size: $pkgMB MB"

# ---------- 4. install into app ----------
$vendor = "$ws\web\js\vendor\sherpa"
Copy-Item "$pkg\sherpa-onnx-wasm-main-tts.data" "$vendor\" -Force
Copy-Item "$pkg\sherpa-onnx-wasm-main-tts.js" "$vendor\" -Force
Say "installed into app vendor dir"

# ---------- 5. preview + self check ----------
$rt = "$tool\rt-check"
Remove-Item $rt -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $rt | Out-Null
Copy-Item "$vendor\*" $rt -Force
$rtUrl = ($rt -replace '\\','/') + "/"
& $node "$ws\scripts\tts-preview.cjs" $rtUrl "$tool\preview-ft-final.wav" "$ws\scripts\train\preview_words.txt" *> "$tool\preview-ft.log"
Say "preview exit code: $LASTEXITCODE"

$measure = @'
import numpy as np, soundfile as sf, os
t = r"C:\Users\g67\Documents\deepseek-harness\default-workspace\toolchain"
def hf(path, label):
    if not os.path.exists(path):
        print("%-30s missing" % label); return
    a, sr = sf.read(path, dtype="float32")
    if a.ndim > 1: a = a.mean(axis=1)
    win = 1024; flat = []
    for i in range(0, len(a)-win, win):
        seg = a[i:i+win]
        if np.abs(seg).max() < 1e-4: continue
        S = np.abs(np.fft.rfft(seg*np.hanning(win)))**2 + 1e-12
        flat.append(np.exp(np.log(S).mean())/S.mean())
    S = np.abs(np.fft.rfft(a*np.hanning(len(a))))**2
    fr = np.fft.rfftfreq(len(a), 1/sr)
    hi = S[fr>3000].sum()/max(S.sum(),1e-12)
    print("%-30s flatness %.4f  HF(>3k) %.4f" % (label, float(np.median(flat)), hi))
print("=== self check: HF noise should approach training-set level ===")
hf(os.path.join(t,"voice-dataset","wavs","00000.wav"), "training set (clean ref)")
hf(os.path.join(t,"preview-ft-final.wav"), "fine-tuned model")
hf(os.path.join(t,"preview-final.wav"), "before (noisy)")
'@
$mt = Join-Path $env:TEMP "hfcheck.py"
[System.IO.File]::WriteAllText($mt, $measure, [System.Text.UTF8Encoding]::new($false))
& $py $mt 2>&1 | ForEach-Object { Say $_ }

# ---------- 6. rebuild APK ----------
Say "rebuilding APK..."
$jdk = "$tool\jdk-17.0.20.1+1"; $sdk = "$tool\android-sdk"
$env:JAVA_HOME = $jdk; $env:ANDROID_HOME = $sdk; $env:ANDROID_SDK_ROOT = $sdk
$env:GRADLE_USER_HOME = "$tool\.gradle"; $env:ANDROID_USER_HOME = "$tool\android-home"
$env:JAVA_TOOL_OPTIONS = "-Djava.io.tmpdir=$tool\tmp"; $env:_JAVA_OPTIONS = "-Djava.io.tmpdir=$tool\tmp"
$env:Path = "C:\Users\g67\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin;$jdk\bin;$env:Path"
Push-Location $ws
& $node "$ws\scripts\sync-web.mjs" "mobile\www" | Out-Null
Push-Location "$ws\mobile"
& $node "$ws\mobile\node_modules\@capacitor\cli\bin\capacitor" sync android 2>&1 | Select-Object -Last 1 | ForEach-Object { Say $_ }
Push-Location "$ws\mobile\android"
& .\gradlew.bat assembleDebug --no-daemon 2>&1 | Select-Object -Last 3 | ForEach-Object { Say $_ }
$apk = "$ws\mobile\android\app\build\outputs\apk\debug\app-debug.apk"
if (Test-Path $apk) {
  $mb = [math]::Round((Get-Item $apk).Length/1MB, 1)
  Copy-Item $apk "D:\WordSteps\成品\词阶-WordSteps-Android-专属音色-v2.apk" -Force
  Say "APK updated: $mb MB -> D:\WordSteps\成品\词阶-WordSteps-Android-专属音色-v2.apk"
} else { Say "!! APK not produced" }
Pop-Location; Pop-Location; Pop-Location

# ---------- 7. copy preview ----------
if (Test-Path "$tool\preview-ft-final.wav") {
  Copy-Item "$tool\preview-ft-final.wav" "D:\WordSteps\试听C-微调后音色.wav" -Force
  Say "preview copied to D:\WordSteps\试听C-微调后音色.wav"
}
Say "=== finish done ==="
