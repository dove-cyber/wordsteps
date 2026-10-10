#!/usr/bin/env python3
"""词阶 WordSteps —— 自定义音色训练一键编排
参考音频 -> GPT-SoVITS 生成数据集 -> Piper VITS 训练 -> 导出 ONNX

用法:
  python train_voice.py --ref <角色音频> --name <音色名> [--texts corpus_en.txt] [--epochs 2000] [--limit 0]

产物(输出到 <out>/):
  dataset/            训练集(wavs + metadata.csv)
  <name>.json         音色配置
  <name>.onnx         最终模型(sherpa-onnx 兼容)
"""
import argparse
import os
import shutil
import subprocess
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(_HERE, "..", ".."))
TOOLCHAIN = os.path.abspath(os.path.join(_HERE, "..", "..", "..", "toolchain"))
PY = os.path.join(TOOLCHAIN, "tts-venv", "Scripts", "python.exe")
FFMPEG_BIN = os.path.join(TOOLCHAIN, "ffmpeg", "bin")


def run(cmd, desc):
    print(f"\n{'=' * 70}\n>>> {desc}\n{'=' * 70}")
    env = dict(os.environ)
    env["TEMP"] = os.path.join(TOOLCHAIN, "tmp")
    env["TMP"] = env["TEMP"]
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    env["PATH"] = FFMPEG_BIN + os.pathsep + os.path.join(TOOLCHAIN, "mingw", "bin") + os.pathsep + env.get("PATH", "")
    r = subprocess.run([PY] + cmd, env=env, cwd=ROOT)
    if r.returncode != 0:
        print(f"!!! 步骤失败: {desc} (exit {r.returncode})")
        sys.exit(r.returncode)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ref", required=True, help="角色参考音频")
    ap.add_argument("--name", default="myvoice", help="音色名")
    ap.add_argument("--texts", default=os.path.join(_HERE, "corpus_en.txt"))
    ap.add_argument("--out", default=os.path.join(TOOLCHAIN, "voice-out"))
    ap.add_argument("--epochs", type=int, default=2000)
    ap.add_argument("--sample-rate", type=int, default=22050)
    ap.add_argument("--limit", type=int, default=0, help="限制合成句数(测试用)")
    ap.add_argument("--batch-size", type=int, default=16)
    ap.add_argument("--skip-dataset", action="store_true", help="跳过数据集生成(复用已有)")
    args = ap.parse_args()

    out = os.path.abspath(args.out)
    dataset = os.path.join(out, "dataset")
    cache = os.path.join(out, "cache")
    config_json = os.path.join(out, args.name + ".json")
    onnx_out = os.path.join(out, args.name + ".onnx")
    os.makedirs(out, exist_ok=True)
    os.makedirs(cache, exist_ok=True)

    # ---------- 1. 生成数据集 ----------
    if not args.skip_dataset:
        cmd = [
            os.path.join(ROOT, "scripts", "train", "generate_dataset.py"),
            "--ref", os.path.abspath(args.ref),
            "--texts", os.path.abspath(args.texts),
            "--out", dataset,
            "--sample-rate", str(args.sample_rate),
        ]
        if args.limit:
            cmd += ["--limit", str(args.limit)]
        run(cmd, "1/3 GPT-SoVITS 生成训练集")

    csv_path = os.path.join(dataset, "metadata.csv")
    if not os.path.exists(csv_path):
        print("找不到 metadata.csv:", csv_path, file=sys.stderr)
        return 1

    # ---------- 2. Piper 训练 ----------
    run([
        "-m", "piper.train", "fit",
        "--data.voice_name", args.name,
        "--data.csv_path", csv_path,
        "--data.audio_dir", dataset,
        "--model.sample_rate", str(args.sample_rate),
        "--data.espeak_voice", "en-us",
        "--data.cache_dir", cache,
        "--data.config_path", config_json,
        "--data.batch_size", str(args.batch_size),
        "--trainer.max_epochs", str(args.epochs),
        "--trainer.accelerator", "gpu",
        "--trainer.devices", "1",
        "--trainer.enable_progress_bar", "false",
    ], "2/3 Piper VITS 训练")

    # ---------- 3. 找最佳检查点并导出 ----------
    logs = os.path.join(ROOT, "lightning_logs")
    ckpts = []
    for root, _dirs, files in os.walk(logs):
        for f in files:
            if f.endswith(".ckpt") and "last" not in f:
                ckpts.append(os.path.join(root, f))
    if not ckpts:
        print("找不到检查点", file=sys.stderr)
        return 1
    # 按 val_mel 最小挑最佳
    def score(p):
        import re
        m = re.search(r"val_mel=([0-9.]+)", os.path.basename(p))
        return float(m.group(1)) if m else 9e9
    best = min(ckpts, key=score)
    print("最佳检查点:", best)

    run([
        "-m", "piper.train.export_onnx",
        "--checkpoint", best,
        "--output-file", onnx_out,
    ], "3/4 导出 ONNX")

    # ---------- 4a. 补 sherpa-onnx 元数据 ----------
    run([
        os.path.join(ROOT, "scripts", "train", "add_onnx_metadata.py"),
        onnx_out, str(args.sample_rate), "1", "en-us",
    ], "4/4 写入 ONNX 元数据(sample_rate 等)")

    # ---------- 4b. 重打包 sherpa-onnx .data ----------
    node = shutil.which("node") or "node"
    glue = os.path.join(ROOT, "web", "js", "vendor", "sherpa", "sherpa-onnx-wasm-main-tts.js")
    data = os.path.join(ROOT, "web", "js", "vendor", "sherpa", "sherpa-onnx-wasm-main-tts.data")
    repack = os.path.join(ROOT, "scripts", "repack-sherpa-model.mjs")
    run([repack, glue, data, onnx_out, os.path.join(out, "sherpa-package")],
        "4/4 重打包 sherpa-onnx 模型包")

    print(f"\n{'=' * 70}\n完成!\n  音色模型: {onnx_out}\n  音色配置: {config_json}\n"
          f"  sherpa 包: {os.path.join(out, 'sherpa-package')} (替换 web/js/vendor/sherpa/ 后打包 APK)\n{'=' * 70}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
