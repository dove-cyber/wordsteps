#!/usr/bin/env python3
"""给 Piper 导出的 ONNX 补齐 sherpa-onnx 所需的 metadata_props。
sherpa-onnx 读取 ONNX 的 metadata 获取 sample_rate / n_speakers / voice 等,
Piper 的 export_onnx 不会写入这些字段,必须补上,否则报
"'sample_rate' does not exist in the metadata"。

用法: python add_onnx_metadata.py <model.onnx> <sample_rate> [n_speakers] [voice]
"""
import sys

import onnx


def main():
    if len(sys.argv) < 3:
        print("用法: add_onnx_metadata.py <model.onnx> <sample_rate> [n_speakers] [voice]")
        return 1
    path = sys.argv[1]
    sample_rate = int(sys.argv[2])
    n_speakers = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    voice = sys.argv[4] if len(sys.argv) > 4 else "en-us"

    m = onnx.load(path)
    meta = {
        "sample_rate": sample_rate,
        "n_speakers": n_speakers,
        "voice": voice,
        "language": "English",
        "comment": "piper",
        "model_type": "vits",
        "has_espeak": 1,
        "version": 1,
    }
    keys = set(meta)
    for p in list(m.metadata_props):
        if p.key in keys:
            m.metadata_props.remove(p)
    for k, v in meta.items():
        e = m.metadata_props.add()
        e.key = k
        e.value = str(v)

    onnx.save(m, path)
    print("已写入 metadata:", meta)
    return 0


if __name__ == "__main__":
    sys.exit(main())
