#!/usr/bin/env python3
"""清理官方 Piper 检查点的超参,使其能作为当前版本 piper 的 --ckpt_path 微调起点。

官方 lessac 检查点由旧版 Piper 训练, hyper_parameters 是【扁平结构】,
混了模型参数 + data 参数 + trainer 参数, 当前 LightningCLI 解析时会报:
  "Subcommand 'fit' does not accept option 'model.sample_bytes'"
做法: 只保留当前 VitsModel.__init__ 接受的键。

顺带解决: PyTorch 2.6+ weights_only 默认 True + pathlib.PosixPath 无法在 Windows 实例化。

用法: python clean_ckpt_hparams.py <输入.ckpt> <输出.ckpt>
"""
import inspect
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


def load_ckpt(path):
    mod = types.ModuleType("patched_pickle")
    mod.Unpickler = PatchedUnpickler
    mod.load = pickle.load
    mod.dump = pickle.dump
    mod.Pickler = pickle.Pickler
    mod.HIGHEST_PROTOCOL = pickle.HIGHEST_PROTOCOL
    mod.BytesIO = io.BytesIO
    return torch.load(path, map_location="cpu", weights_only=False, pickle_module=mod)


def main():
    if len(sys.argv) < 3:
        print("用法: clean_ckpt_hparams.py <输入.ckpt> <输出.ckpt>")
        return 1
    src, dst = sys.argv[1], sys.argv[2]

    from piper.train.vits.lightning import VitsModel
    accepted = set(inspect.signature(VitsModel.__init__).parameters.keys()) - {"self"}
    print("当前 VitsModel 接受 %d 个参数" % len(accepted))

    ck = load_ckpt(src)
    hp = ck.get("hyper_parameters", {})
    if isinstance(hp, dict) and "model" in hp and isinstance(hp["model"], dict):
        # 已经是嵌套结构
        kept = {k: v for k, v in hp["model"].items() if k in accepted}
        dropped = [k for k in hp["model"] if k not in accepted]
        hp["model"] = kept
    else:
        kept = {k: v for k, v in hp.items() if k in accepted}
        dropped = [k for k in hp if k not in accepted]
        hp = kept

    print("保留 %d 个键, 移除 %d 个: %s" % (len(kept), len(dropped), ", ".join(dropped[:14]) + ("..." if len(dropped) > 14 else "")))
    ck["hyper_parameters"] = hp

    torch.save(ck, dst)
    print("已保存:", dst)
    return 0


if __name__ == "__main__":
    sys.exit(main())
