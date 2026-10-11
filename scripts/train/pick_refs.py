#!/usr/bin/env python3
"""从长音频中自动挑选适合当 GPT-SoVITS 参考的短片段(3~10秒)。
挑选依据: 语音段连续(少静音)、电平稳定、不削波、避开明显杂音。"""
import os
import sys

import numpy as np
import soundfile as sf

WAV = sys.argv[1]
OUTDIR = sys.argv[2]
SR = 22050
N = int(sys.argv[3]) if len(sys.argv) > 3 else 5
SEG = 6.0

a, sr = sf.read(WAV, dtype="float32")
if a.ndim > 1:
    a = a.mean(axis=1)
assert sr == SR, f"采样率应为 {SR}, 实际 {sr}"
os.makedirs(OUTDIR, exist_ok=True)

# 0.1 秒一帧的 RMS
fw = int(0.1 * SR)
nf = len(a) // fw
rms = np.array([np.sqrt((a[i * fw:(i + 1) * fw] ** 2).mean()) for i in range(nf)])
peak = np.abs(a).max()

# 逐 6 秒窗口打分
w = int(SEG * SR)
step = int(1.0 * SR)  # 每秒一个候选窗口
scores = []
for start in range(0, len(a) - w, step):
    seg = a[start:start + w]
    r = rms[start // fw:(start + w) // fw]
    if len(r) < 40:
        continue
    active = (r > 0.02).mean()          # 语音占比
    if active < 0.85:                   # 要求连续说话,少停顿
        continue
    level = np.median(r)
    if level < 0.03:                    # 太轻
        continue
    clip = (np.abs(seg) > 0.98).mean()  # 削波比例
    if clip > 0.0005:
        continue
    stability = 1.0 - min(1.0, np.std(r) / max(np.mean(r), 1e-9))  # 电平稳定度
    scores.append((active * 1.0 + stability * 1.5 - clip * 50, start, level, stability))

scores.sort(reverse=True)
print("候选数:", len(scores))
# 选出彼此间隔 > 30 秒的最佳片段,保证音色多样
picked = []
for sc, start, level, stab in scores:
    if any(abs(start - p) < 30 * SR for p in picked):
        continue
    picked.append(start)
    if len(picked) >= N:
        break

print("\n挑出 %d 个参考片段:" % len(picked))
for i, start in enumerate(picked):
    seg = a[start:start + w]
    # 归一化到 -3dB 左右,避免过轻/过响
    m = np.abs(seg).max()
    if m > 0:
        seg = seg * (0.7 / m)
    seg = np.clip(seg, -1, 1)
    out = os.path.join(OUTDIR, "ref_%02d.wav" % (i + 1))
    sf.write(out, (seg * 32767).astype(np.int16), SR, subtype="PCM_16")
    print("  %s  位置 %6.1fs  电平 %.3f" % (out, start / SR, np.median(rms[start // fw:(start + w) // fw])))

# 另存一个"整段可用区间"清单,便于后续切数据集
print("\n(参考片段已写入 %s)" % OUTDIR)
