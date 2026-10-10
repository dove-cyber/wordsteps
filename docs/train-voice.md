# 自定义音色训练 Skill（Piper/VITS → sherpa-onnx）

> 用途：在自己有 CUDA 显卡的机器上，训练一个**与词阶 WordSteps 完全兼容**的自定义音色（含动漫角色音），导出 ONNX 后接入 APK/EXE。
> 当前架构用的是 sherpa-onnx + Piper(VITS) 模型，所以训练框架就是 **Piper**。

---

## 0. 前置条件（缺一不可）

- Linux 或 WSL2（推荐 Ubuntu 22.04）
- NVIDIA 显卡，建议 **≥8GB 显存**
- CUDA 11.x/12.x + 对应驱动
- Python 3.10+
- ffmpeg（音频处理）
- 约 20GB 磁盘

---

## 1. 准备训练数据（最难、最耗时的一步）

Piper 需要「干净的单一音色音频 + 文字标注」。

### 1.1 数据格式要求

```
dataset/
├── metadata.csv          # 两列:音频相对路径|文字
├── wavs/
│   ├── 0001.wav          # 22050 Hz, 单声道, 16bit
│   ├── 0002.wav
│   └── ...
```

`metadata.csv` 每行一条：
```
wavs/0001.wav|hello world
wavs/0002.wav|good morning
```

### 1.2 获取角色语音（动漫角色）

动漫角色台词通常混着 BGM/音效，需要先**人声分离**：

1. 用 **UVR5**（Ultimate Vocal Remover）或 **Demucs**（`demucs --two-stems=vocals`）把台词人声从 BGM 里分离出来。
2. 切分成短句（2~15 秒/条），逐条配文字标注。
3. 素材来源建议：游戏语音包、广播剧、角色曲、有声内容（注意版权，仅供自用学习）。

> 若无干净数据，也可先用 GPT-SoVITS 少量样本克隆 → 批量生成合成语音 → 作为 Piper 的训练数据（这样最终导出的是 sherpa-onnx 兼容格式）。

### 1.3 一键预处理（转 22050Hz 单声道 + 生成 metadata.csv）

把原始音频放进 `raw/` 目录，运行：
```bash
python scripts/train/prepare_dataset.py --raw raw/ --out dataset/
```
脚本会自动：转码 → 统一 22050Hz/单声道/16bit → 生成 `metadata.csv` 模板（文字列留空，需你手动补全标注）。

---

## 2. 训练（GPU）

```bash
# 1) 克隆 Piper 训练仓库
git clone https://github.com/rhasspy/piper
cd piper/src/python

# 2) 建虚拟环境并装依赖(参考仓库 TRAINING.md,不同版本依赖略有差异)
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pip install torch --index-url https://download.pytorch.org/whl/cu118  # 按你的 CUDA 版本选

# 3) 训练(medium 档;small 更快但音质略低,large 最好但更慢)
python3 -m piper_train \
    --dataset-dir /path/to/dataset \
    --config configs/en.json \
    --accelerator gpu \
    --devices 1 \
    --batch-size 32 \
    --max-epochs 10000
```

训练时长：单音色 medium 档，3~10 小时数据，8GB 显卡约 **半天~1 天**。

---

## 3. 导出 ONNX

训练得到 checkpoint 后导出：
```bash
python3 -m piper_train.export_onnx \
    /path/to/checkpoint.ckpt \
    /path/to/output/model.onnx
```

同时需要：
- `tokens.txt`（训练时生成的音素表）
- `espeak-ng-data/`（语音学转写用，Piper 仓库里有）

最终三个东西：`model.onnx` + `tokens.txt` + `espeak-ng-data/`，就是 sherpa-onnx 认的 `vits-piper` 模型。

---

## 4. 接入词阶 WordSteps

### 4.1 原生 Android（推荐，最省事）

sherpa-onnx 官方 Android 库支持在运行时直接加载任意 VITS 模型文件，无需重编译 WASM：

1. 在 `mobile/android/app/build.gradle` 加依赖：
   ```gradle
   implementation 'com.k2fsa.sherpa.onnx:sherpa-onnx-android:<版本>'
   ```
2. 把 `model.onnx` + `tokens.txt` 放进 `mobile/android/app/src/main/assets/`，`espeak-ng-data/` 一并放入。
3. 写一个 Capacitor 插件（Kotlin），核心逻辑：
   ```kotlin
   val tts = OfflineTts(
     config = OfflineTtsConfig(
       model = OfflineTtsVitsModelConfig(
         model = "model.onnx", tokens = "tokens.txt", dataDir = "espeak-ng-data"
       )
     )
   )
   val audio = tts.generate(text = "hello", sid = 0, speed = 1.0f)
   // 播放 audio.samples / audio.sampleRate
   ```
4. `npx cap sync` + `gradlew assembleDebug` 重打包。

### 4.2 WASM 版（当前 APP 用的方式）

模型被编译进了 `.data`，换模型需要**用 Emscripten 重新编译 WASM 包**（在 Linux/WSL 跑 sherpa-onnx 的 wasm 构建脚本），较繁琐。因此**换自定义音色建议走 4.1 原生方案**。

---

## 5. 常见坑

| 问题 | 解决 |
| --- | --- |
| 训练到一半显存不够 | 降 `--batch-size`，或换 `small` 档 |
| 音色有杂音/不自然 | 数据清洗不够：UVR 分离更彻底、切掉静音和 BGM 残留 |
| 导出 onnx 后 sherpa 报错 | 确认 `tokens.txt` 与训练时一致；`dataDir` 指向 `espeak-ng-data` |
| 只有一张显卡被占满 | `--devices 1` 改为 `--devices 0,` 多卡并行 |
