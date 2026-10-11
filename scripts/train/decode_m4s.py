#!/usr/bin/env python3
"""把 m4s/mp4 音频解码为 WAV(单声道),并做基础分析(时长/响度分布/静音段)。"""
import os
import sys

import av
import numpy as np
import soundfile as sf

SRC = sys.argv[1] if len(sys.argv) > 1 else r"D:\WordSteps\训练素材\28862451638-1-30232.m4s"
DST = sys.argv[2] if len(sys.argv) > 2 else r"C:\Users\g67\Documents\deepseek-harness\default-workspace\toolchain\voice-raw-22k.wav"
SR = 22050

print("解码中:", SRC)
c = av.open(SRC)
rs = av.audio.resampler.AudioResampler(format="s16", layout="mono", rate=SR)
chunks = []
n = 0
for frame in c.decode(audio=0):
    for rf in rs.resample(frame):
        chunks.append(rf.to_ndarray().reshape(-1))
    n += 1
    if n % 2000 == 0:
        print("  已解码 %d 帧 (~%.1f 分钟)" % (n, len(chunks) * 1024 / SR / 60))
for rf in rs.resample(None):
    chunks.append(rf.to_ndarray().reshape(-1))
c.close()

audio = np.concatenate(chunks).astype(np.int16)
sf.write(DST, audio, SR, subtype="PCM_16")
dur = len(audio) / SR
print("\n已写出:", DST)
print("时长: %.1f 秒 (%.1f 分钟)  采样率: %d  采样点: %d" % (dur, dur / 60, SR, len(audio)))

# ---- 基础分析 ----
a = audio.astype(np.float32) / 32768.0
print("\n=== 幅度统计 ===")
print("峰值: %.4f   均方根: %.4f" % (np.abs(a).max(), np.sqrt((a ** 2).mean())))
# 逐秒 RMS,看响度分布
win = SR
n_sec = len(a) // win
rms = np.array([np.sqrt((a[i * win:(i + 1) * win] ** 2).mean()) for i in range(n_sec)])
print("\n=== 逐秒响度分布 ===")
for lo in [0, 0.01, 0.02, 0.05, 0.1, 0.2]:
    hi = {0: 0.01, 0.01: 0.02, 0.02: 0.05, 0.05: 0.1, 0.1: 0.2, 0.2: 1.0}[lo]
    cnt = int(((rms >= lo) & (rms < hi)).sum())
    print("  RMS %.2f~%.2f : %5d 秒 (%.1f%%)" % (lo, hi, cnt, cnt / max(n_sec, 1) * 100))
print("  静音(<0.005) : %5d 秒" % int((rms < 0.005).sum()))

# 估算有效语音时长(去掉极静音)
active = (rms > 0.01).sum()
print("\n有效语音段(RMS>0.01): 约 %d 秒 (%.1f 分钟)" % (active, active / 60))
