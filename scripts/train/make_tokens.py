#!/usr/bin/env python3
"""从 Piper 训练产出的 <voice>.json 生成 sherpa-onnx 用的 tokens.txt。
关键: 必须用【模型自己的】音素表,否则与运行时里旧模型的 tokens.txt 不匹配
(典型症状: 双元音 aɪ/aʊ/eɪ/oʊ/ɔɪ 查不到 id 被丢弃 => 输出电流噪声)。

用法: python make_tokens.py <voice.json> <输出 tokens.txt>
"""
import json
import sys


def main():
    if len(sys.argv) < 3:
        print("用法: make_tokens.py <voice.json> <tokens.txt>")
        return 1
    src, dst = sys.argv[1], sys.argv[2]
    j = json.load(open(src, encoding="utf-8"))
    m = j.get("phoneme_id_map") or {}
    if not m:
        print("json 里没有 phoneme_id_map", file=sys.stderr)
        return 1

    items = []
    dropped = []
    for k, v in m.items():
        i = v[0] if isinstance(v, list) else v
        # sherpa 的 ReadTokens 要求每个音素是【单个 Unicode 字符】(Utf8ToUtf32 后 size==1),
        # 多字符音素(如合并双元音 aɪ/aʊ/eɪ/oʊ/ɔɪ)会被拒绝并直接退出。
        # 而 espeak 音素化默认输出的就是单字符(a + ɪ 分开),所以这些多字符项本就用不到。
        if len(k) != 1:
            dropped.append((i, k))
            continue
        items.append((i, k))
    items.sort()

    with open(dst, "w", encoding="utf-8", newline="\n") as fp:
        for i, k in items:
            fp.write("%s %d\n" % (k, i))

    print("已写出 %s (%d 个音素)" % (dst, len(items)))
    if dropped:
        print("已剔除 %d 个多字符音素(sherpa 不接受): %s"
              % (len(dropped), ", ".join(repr(k) for _, k in dropped)))
    # 校验关键音素
    syms = {k for _, k in items}
    for d in ["ɝ", "ʷ", "ˈ", "ˌ", "ː", " ", "ə", "ɪ", "ʊ"]:
        print("  %r: %s" % (d, "在" if d in syms else "缺失!"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
