#!/usr/bin/env python3
"""词阶 WordSteps —— 用 GPT-SoVITS(ref_free 免参考文本模式)从角色参考音频批量合成训练集
输出 Piper 训练格式: <out>/wavs/*.wav + <out>/metadata.csv

用法:
  python generate_dataset.py --ref <角色参考音频> --texts <每行一句的文本文件> --out <输出目录>

说明:
  - GPT-SoVITS 要求参考音频在 3~10 秒,脚本会自动裁剪到 6 秒
  - 用 ref_free 模式(免参考文本),因此不需要日语/中文音素处理,无需 pyopenjtalk
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import time

_HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(_HERE, "..", ".."))
GSV = os.path.abspath(os.path.join(_HERE, "..", "..", "..", "toolchain", "GPT-SoVITS"))


def find_ffmpeg():
    p = shutil.which("ffmpeg")
    if p:
        return p
    cand = os.path.join(os.path.dirname(GSV), "ffmpeg", "bin", "ffmpeg.exe")
    return cand if os.path.exists(cand) else None


def prepare_ref(ref, workdir):
    """把参考音频裁剪到 3~10 秒范围内"""
    ff = find_ffmpeg()
    if not ff:
        print("⚠️ 未找到 ffmpeg,跳过参考音频裁剪")
        return ref
    ffprobe = os.path.join(os.path.dirname(ff), "ffprobe.exe")
    dur = 0.0
    try:
        pr = subprocess.run(
            [ffprobe, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", ref],
            capture_output=True, text=True,
        )
        dur = float(pr.stdout.strip())
    except Exception:
        dur = 0.0
    if 3.0 <= dur <= 10.0:
        print(f"参考音频 {dur:.1f}s,符合 3~10s 要求")
        return ref
    out = os.path.join(workdir, "ref_prepared.wav")
    subprocess.run([ff, "-y", "-i", ref, "-t", "6", "-ar", "32000", "-ac", "1", out],
                   capture_output=True)
    print(f"参考音频 {dur:.1f}s 超出 3~10s,已裁剪为 6s")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ref", required=True, help="角色参考音频(wav/mp3)")
    ap.add_argument("--texts", required=True, help="待合成文本,每行一句")
    ap.add_argument("--out", required=True, help="输出数据集目录")
    ap.add_argument("--lang", default="en", help="目标语言(默认 en)")
    ap.add_argument("--limit", type=int, default=0, help="只合成前 N 句(0=全部)")
    ap.add_argument("--sample-rate", type=int, default=22050, help="输出采样率(Piper 标准 22050)")
    ap.add_argument("--aux-refs", default="", help="附加参考音频(逗号分隔),多参考可提升音色稳定性")
    args = ap.parse_args()

    if not os.path.isdir(GSV):
        print("找不到 GPT-SoVITS:", GSV, file=sys.stderr)
        return 1

    # 先转绝对路径(后面会 chdir)
    ref = os.path.abspath(args.ref)
    texts_path = os.path.abspath(args.texts)
    out_dir = os.path.abspath(args.out)

    if not os.path.exists(ref):
        print("参考音频不存在:", ref, file=sys.stderr)
        return 1

    workdir = tempfile.mkdtemp(prefix="ws-ref-")
    ref = prepare_ref(ref, workdir)
    aux = []
    if args.aux_refs:
        for p in args.aux_refs.split(","):
            p = p.strip()
            if not p:
                continue
            ap_ = os.path.abspath(p)
            if os.path.exists(ap_):
                aux.append(prepare_ref(ap_, workdir))
    if aux:
        print("附加参考音频 %d 个" % len(aux))

    sys.path.insert(0, GSV)
    sys.path.insert(0, os.path.join(GSV, "GPT_SoVITS"))
    os.chdir(GSV)

    import soundfile as sf
    from TTS_infer_pack.TTS import TTS, TTS_Config

    cfg = TTS_Config(os.path.join(GSV, "GPT_SoVITS", "configs", "tts_infer.yaml"))
    tts = TTS(cfg)
    print("GPT-SoVITS 就绪 | version:", cfg.version, "| device:", cfg.device)

    with open(texts_path, encoding="utf-8") as fp:
        texts = [ln.strip() for ln in fp if ln.strip()]
    if args.limit:
        texts = texts[: args.limit]

    wavs_dir = os.path.join(out_dir, "wavs")
    os.makedirs(wavs_dir, exist_ok=True)
    meta = []
    t0 = time.time()

    for i, text in enumerate(texts):
        inputs = {
            "text": text,
            "text_lang": args.lang,
            "ref_audio_path": ref,
            "prompt_text": "",          # 空 => ref_free 免参考文本
            "prompt_lang": args.lang,
            "aux_ref_audio_paths": aux,
            "top_k": 15,
            "top_p": 1.0,
            "temperature": 1.0,
            "text_split_method": "cut0",
            "batch_size": 1,
            "speed_factor": 1.0,
            "split_bucket": False,
            "return_fragment": False,
            "fragment_interval": 0.3,
            "seed": 42,
            "parallel_infer": True,
            "repetition_penalty": 1.35,
        }
        name = f"{i:05d}.wav"
        path = os.path.join(wavs_dir, name)
        try:
            ok = False
            for sr, audio in tts.run(inputs):
                # 重采样到目标采样率(Piper 标准 22050)
                if sr != args.sample_rate:
                    import numpy as np
                    import librosa
                    a = audio.astype(np.float32) / 32768.0
                    a = librosa.resample(a, orig_sr=sr, target_sr=args.sample_rate)
                    a = np.clip(a, -1.0, 1.0)
                    audio = (a * 32767.0).astype("int16")
                    sr = args.sample_rate
                sf.write(path, audio, sr)
                ok = True
            if ok:
                meta.append(f"wavs/{name}|{text}")
                print(f"[{i + 1}/{len(texts)}] {text}")
            else:
                print(f"[{i + 1}/{len(texts)}] 无输出: {text}")
        except Exception as e:
            print(f"[{i + 1}/{len(texts)}] FAIL {type(e).__name__}: {str(e)[:100]}")

        if (i + 1) % 20 == 0:
            el = time.time() - t0
            eta = el / (i + 1) * (len(texts) - i - 1)
            print(f"--- 进度 {i + 1}/{len(texts)} | 已用 {el:.0f}s | 预计剩余 {eta:.0f}s ---")

    with open(os.path.join(out_dir, "metadata.csv"), "w", encoding="utf-8") as fp:
        fp.write("\n".join(meta) + "\n")

    print(f"\n完成: {len(meta)}/{len(texts)} 条 -> {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
