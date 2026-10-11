#!/usr/bin/env python3
"""把 Linux 上训练的 PyTorch 检查点转成 Windows 可载入的格式。

问题: 官方 Piper 检查点里 pickle 了 pathlib.PosixPath,Windows 上:
  1) PyTorch 2.6+ 默认 weights_only=True => 拒绝未知全局
  2) 即便放行, pathlib.PosixPath.__new__ 在 Windows 上直接 NotImplementedError
做法: 用自定义 Unpickler 把 PosixPath 映射成 WindowsPath 后载入, 再重新保存。

用法: python convert_ckpt.py <输入.ckpt> <输出.ckpt>
"""
import io
import pathlib
import pickle
import sys
import types

import torch


class PatchedUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        if module == "pathlib":
            if name == "PosixPath":
                return pathlib.WindowsPath
            if name == "PurePosixPath":
                return pathlib.PureWindowsPath
        return super().find_class(module, name)


def main():
    if len(sys.argv) < 3:
        print("用法: convert_ckpt.py <输入.ckpt> <输出.ckpt>")
        return 1
    src, dst = sys.argv[1], sys.argv[2]

    mod = types.ModuleType("patched_pickle")
    mod.Unpickler = PatchedUnpickler
    mod.load = pickle.load
    mod.dump = pickle.dump
    mod.Pickler = pickle.Pickler
    mod.HIGHEST_PROTOCOL = pickle.HIGHEST_PROTOCOL
    mod.BytesIO = io.BytesIO  # torch 内部可能引用

    print("载入:", src)
    ck = torch.load(src, map_location="cpu", weights_only=False, pickle_module=mod)
    print("载入成功, 顶层键:", list(ck.keys())[:10] if isinstance(ck, dict) else type(ck))

    torch.save(ck, dst)
    print("已保存:", dst)

    # 验证可再次载入(模拟 piper 的加载路径)
    ck2 = torch.load(dst, map_location="cpu", weights_only=False)
    print("复验载入成功, 键数:", len(ck2) if isinstance(ck2, dict) else "?")
    return 0


if __name__ == "__main__":
    sys.exit(main())
