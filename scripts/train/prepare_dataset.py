#!/usr/bin/env python3
"""词阶 WordSteps —— 自定义音色训练数据预处理脚本
把原始音频统一转成 Piper 要求的 22050Hz/单声道/16bit WAV,并生成 metadata.csv 模板。
用法: python prepare_dataset.py --raw raw/ --out dataset/
依赖: ffmpeg(需在 PATH)
"""
import argparse
import csv
import os
import subprocess
import sys

SR = 22050


def convert(inp, outp):
    subprocess.run([
        "ffmpeg", "-y", "-i", inp,
        "-ac", "1", "-ar", str(SR), "-sample_fmt", "s16",
        outp,
    ], check=True, capture_output=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", required=True, help="原始音频目录")
    ap.add_argument("--out", required=True, help="输出数据集目录")
    args = ap.parse_args()

    raw_dir = os.path.abspath(args.raw)
    out_dir = os.path.abspath(args.out)
    wavs_dir = os.path.join(out_dir, "wavs")
    os.makedirs(wavs_dir, exist_ok=True)

    exts = {".wav", ".mp3", ".flac", ".m4a", ".ogg", ".opus", ".aac"}
    rows = []
    idx = 0
    for root, _, files in os.walk(raw_dir):
        for f in sorted(files):
            if os.path.splitext(f)[1].lower() not in exts:
                continue
            idx += 1
            src = os.path.join(root, f)
            name = f"{idx:04d}.wav"
            dst = os.path.join(wavs_dir, name)
            try:
                convert(src, dst)
            except subprocess.CalledProcessError as e:
                print(f"跳过(转码失败) {src}: {e.stderr.decode(errors='ignore')[:200]}", file=sys.stderr)
                continue
            rows.append([f"wavs/{name}", ""])  # 文字列留空,需手动补全
            print(f"✓ {name}  <-  {f}")

    meta = os.path.join(out_dir, "metadata.csv")
    with open(meta, "w", newline="", encoding="utf-8") as fp:
        w = csv.writer(fp, delimiter="|")
        for r in rows:
            w.writerow(r)

    print(f"\n完成: {len(rows)} 条音频 -> {wavs_dir}")
    print(f"请编辑 {meta},补全每行的文字标注(第二列)")


if __name__ == "__main__":
    main()
