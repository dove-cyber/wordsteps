#!/usr/bin/env python3
"""训练收尾:找最佳检查点 -> 导出 ONNX -> 补 sherpa 元数据 -> 重打包 sherpa 运行时。

用法:
  python finalize_voice.py --name anon --sample-rate 22050 [--logs <lightning_logs 目录>] [--out <输出目录>]
"""
import argparse
import glob
import os
import re
import shutil
import subprocess
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(_HERE, "..", ".."))
TOOLCHAIN = os.path.abspath(os.path.join(_HERE, "..", "..", "..", "toolchain"))
PY = os.path.join(TOOLCHAIN, "tts-venv", "Scripts", "python.exe")


def run(cmd, desc):
    print(f"\n{'=' * 70}\n>>> {desc}\n{'=' * 70}")
    env = dict(os.environ)
    env["TEMP"] = os.path.join(TOOLCHAIN, "tmp")
    env["TMP"] = env["TEMP"]
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    r = subprocess.run(cmd, env=env, cwd=ROOT)
    if r.returncode != 0:
        print("!!! 失败:", desc, r.returncode)
        sys.exit(r.returncode)


def best_ckpt(logs):
    """挑 val_mel 最小的检查点"""
    cands = []
    for p in glob.glob(os.path.join(logs, "**", "epoch=*.ckpt"), recursive=True):
        m = re.search(r"val_mel=([0-9.]+?)(?:-v|\.ckpt)", os.path.basename(p))
        if m:
            cands.append((float(m.group(1)), os.path.getmtime(p), p))
    if not cands:
        # 退回 last.ckpt
        last = glob.glob(os.path.join(logs, "**", "last.ckpt"), recursive=True)
        if last:
            return max(last, key=os.path.getmtime)
        return None
    # 先按 val_mel 最小,同等取较新的
    cands.sort(key=lambda x: (x[0], -x[1]))
    return cands[0][2]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", default="anon")
    ap.add_argument("--sample-rate", type=int, default=22050)
    ap.add_argument("--logs", default=os.path.join(TOOLCHAIN, "lightning_logs"))
    ap.add_argument("--out", default=os.path.join(TOOLCHAIN, "voice-out"))
    ap.add_argument("--json", default="", help="训练产出的 <name>.json,用于生成配套 tokens.txt")
    ap.add_argument("--glue", default=os.path.join(TOOLCHAIN, "backup-libritts.js"))
    ap.add_argument("--data", default=os.path.join(TOOLCHAIN, "backup-libritts.data"))
    ap.add_argument("--node", default=r"C:\Users\g67\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    ckpt = best_ckpt(args.logs)
    if not ckpt:
        print("找不到任何检查点:", args.logs, file=sys.stderr)
        return 1
    print("最佳检查点:", ckpt)

    onnx_out = os.path.join(args.out, args.name + ".onnx")
    run([PY, "-m", "piper.train.export_onnx", "--checkpoint", ckpt, "--output-file", onnx_out], "1/4 导出 ONNX")
    run([PY, os.path.join(ROOT, "scripts", "train", "add_onnx_metadata.py"), onnx_out,
         str(args.sample_rate), "1", "en-us"], "2/4 补 ONNX 元数据")

    # 3) 生成与模型配套的 tokens.txt —— 必须一起换,否则音素 ID 对不上会产生电流噪声
    json_path = args.json or os.path.join(args.out, args.name + ".json")
    tokens = os.path.join(args.out, args.name + ".tokens.txt")
    if os.path.exists(json_path):
        run([PY, os.path.join(ROOT, "scripts", "train", "make_tokens.py"), json_path, tokens],
            "3/4 生成配套 tokens.txt")
    else:
        print("!! 找不到 %s,无法生成 tokens.txt(会导致噪声)" % json_path)
        return 1

    # 4) 重打包(务必用同一对 glue + .data,脚本内含一致性校验)
    pkg = os.path.join(args.out, "sherpa-package")
    run([args.node, os.path.join(ROOT, "scripts", "repack-sherpa-model.mjs"),
         args.glue, args.data, onnx_out, pkg, "--tokens", tokens],
        "4/4 重打包 sherpa 运行时")

    print(f"\n完成! 音色包: {pkg}")
    print(f"  模型: {onnx_out}")
    print(f"  tokens: {tokens}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
