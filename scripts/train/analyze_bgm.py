#!/usr/bin/env python3
"""分析音频是否含持续背景音乐:分频段能量随时间的变化。
人声对话之间会有停顿(能量掉到很低);持续 BGM 则低频/高频一直有能量。"""
import sys

import numpy as np
import soundfile as sf

WAV = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\g67\Documents\deepseek-harness\default-workspace\toolchain\voice-raw-22k.wav"
SR = 22050

a, sr = sf.read(WAV, dtype="float32")
if a.ndim > 1:
    a = a.mean(axis=1)
print("时长 %.1f 秒, 采样率 %d" % (len(a) / sr, sr))

# 每 0.5 秒一帧,算三个频段能量
win = sr // 2
n = len(a) // win
bands = {"低频 0-150Hz(音乐低音)": (0, 150), "中频 150-4000Hz(人声主体)": (150, 4000), "高频 4k-8kHz(镲片/齿音)": (4000, 8000)}
freqs = np.fft.rfftfreq(win, 1 / sr)
masks = {k: (freqs >= lo) & (freqs < hi) for k, (lo, hi) in bands.items()}

energies = {k: [] for k in bands}
for i in range(n):
    seg = a[i * win:(i + 1) * win]
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
    for k, m in masks.items():
        energies[k].append(spec[m].sum())

print("\n=== 各频段能量(相对该段中位数,取对数) ===")
for k, v in energies.items():
    v = np.array(v)
    med = np.median(v[v > 0]) if (v > 0).any() else 1
    db = 10 * np.log10(np.maximum(v, 1e-12) / max(med, 1e-12))
    print("%-28s 中位=%.1fdB  最低=%.1fdB  10%%分位=%.1fdB" % (k, 0.0, db.min(), np.percentile(db, 10)))

# 关键判据: 低频在整体最安静的 10% 时刻是否仍有可观能量
v_low = np.array(energies["低频 0-150Hz(音乐低音)"])
v_mid = np.array(energies["中频 150-4000Hz(人声主体)"])
quiet_idx = np.argsort(v_mid)[:max(1, n // 10)]
low_med = np.median(v_low[v_low > 0]) if (v_low > 0).any() else 1
low_in_quiet = np.median(v_low[quiet_idx])
ratio = 10 * np.log10(max(low_in_quiet, 1e-12) / max(low_med, 1e-12))
print("\n=== 判据 ===")
print("最安静 10%% 时刻的低频能量 相对 低频中位数: %.1f dB" % ratio)
if ratio > -12:
    print("=> 结论: 人声停顿时低频仍在 => 极可能有【持续背景音乐】")
else:
    print("=> 结论: 人声停顿时低频明显下降 => 大概率是【干声/无持续 BGM】")

# 停顿统计: 中频能量低于中位数 -25dB 的时长
mid_db = 10 * np.log10(np.maximum(v_mid, 1e-12) / max(np.median(v_mid[v_mid > 0]), 1e-12))
pauses = (mid_db < -25).sum() * 0.5
print("\n中频低于中位 -25dB 的时长: %.1f 秒 (%.1f%%)" % (pauses, pauses / (n * 0.5) * 100))
