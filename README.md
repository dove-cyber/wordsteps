# 词阶 WordSteps

> 作者：**鸽浅.strandove**

阶段式英语学习软件（**测试版**）—— 一套代码，兼容 **APK / EXE / HTML** 三种封包格式。

> 参考百词斩、多邻国等成熟语言学习产品，核心是「阶段式学习 + 乱序考察」，并**预留了完整的多语言扩展接口**（界面语言 + 学习内容语言两层解耦），后续可直接扩展成日语、西语等多语言版本。

---

## 一、核心功能

| 功能 | 说明 |
| --- | --- |
| 📄 文档导入 | 上传 `.txt` / `.md` / `.csv` / `.docx`(Word)，自动解析成单词/语句词条 |
| 🪜 阶段式学习 | 采用 **FSRS v6 间隔重复算法**（ts-fsrs）：新词 → 一阶 → 二阶 → 三阶 → 四阶 → 已掌握，答对升阶、答错降阶，到期自动进入复习 |
| 🔀 乱序考察 | 到期内容打乱顺序，随机题型考察：选释义 / 选单词 / 拼写 / 听音拼写 |
| 🎓 多题型学习 | 多邻国式流程：认识环节 → 选择释义 → 拼写/选词，逐题结算 |
| 🔊 发音 | 内置**离线神经 TTS**（sherpa-onnx + Piper 真人录音音色，**完全离线、不联网、不依赖系统语音包**），支持**语速调节 0.5x~2x**；另保留系统 TTS / Web Speech 回退 |
| 🔤 音标 | 自动为英文单词标注**国际音标 (IPA)**（内置 CMUdict 词表，离线查询） |
| 💾 本地存储 | IndexedDB（受限环境自动回退 localStorage），数据全离线、不联网 |
| 🔥 激励体系 | 连续打卡、每日目标、经验/等级、正确率与阶段分布统计 |
| 🌐 语言扩展接口 | 界面语言（i18n）与学习内容语言两层独立可插拔，见下文 |

---

## 二、快速开始（HTML 版，零依赖立即可用）

**方式 A：直接双击打开**

用 Chrome / Edge 打开 `web/index.html` 即可（数据存在浏览器本地）。

**方式 B：本地预览服务器**

```bash
node scripts/serve.mjs        # 然后访问 http://localhost:4173
```

首次使用：进入「**导入**」页 → 点「✨ 一键导入内置示例词库」，即可完整体验学习/复习/考察/统计全流程。也可拖入自己的文档，或使用 `web/sample/` 下的示例文件（含 `.txt` 与 `.docx`）。

---

## 三、三端打包

三者共享同一套 `web/` 代码，打包时把 `web/` 拷入外壳即可，**功能完全一致**。

### 1. HTML —— 已就绪
`web/index.html` 本身就是完整应用，直接分发 `web/` 目录即可。

### 2. EXE（Windows 桌面版，Electron）
```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-exe.ps1
```
- 首次会下载 Electron（约 100MB+）。
- 产物：`desktop/dist/词阶 WordSteps Setup *.exe`（NSIS 安装包）。
- 开发调试：`cd desktop && npm install && npm start`（加载 `../web`）。

### 3. APK（Android 版，Capacitor）
**前置要求**：本机安装 **JDK 17**（`JAVA_HOME`）与 **Android SDK**（`ANDROID_HOME`/`ANDROID_SDK_ROOT`）。
```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-apk.ps1
```
- 首次会 `cap add android` 生成 Android 工程源码（`mobile/android/`）。
- 产物：`mobile/android/app/build/outputs/apk/debug/app-debug.apk`（调试版）。
- 也可用 **Android Studio** 打开 `mobile/android/` 直接运行/发布。

---

## 四、支持的上传文档格式

每行一条，自动识别「单词」或「语句」（含空格即为语句）。支持的分隔方式：

```
apple - 苹果                 # 连字符(两侧空格)
banana: 香蕉                 # 冒号
perseverance	毅力          # Tab 制表符
cherry — 樱桃                # 破折号 / 竖线 | / 等号 = / 逗号(CSV)
apple 苹果                   # 单空格两栏(单词 + 中文释义)
1. date = 日期               # 自动忽略列表序号/项目符号
# 这是注释，会被忽略
```

- `.csv`：逗号分隔，第一列原文、第二列释义。
- `.docx`：按段落解析，每段一行（`.doc` 旧版请先在 Word 中另存为 `.docx`）。
- 重复词条自动去重。

---

## 五、语言扩展接口（重点）

应用把「**界面显示语言**」和「**学习内容语言**」完全解耦，二者均可独立新增，无需改动业务代码。

### 1. 新增界面语言（UI 文案）
1. 复制 `web/js/i18n/en.js` 改名为 `xx.js`；
2. 把字典里的文案翻译成目标语言；
3. 在 `web/index.html` 中引入该文件；
4. 在 `web/js/ui/app.js` 的 `uiNames` 里补一个显示名。

> 例如做日语界面：`js/i18n/ja.js` + 一行注册 `WS.I18N.register('ja', {...})`。

### 2. 新增学习内容语言（决定 TTS 语音、书写方向、解析、出题）
1. 复制 `web/js/langs/en.js` 改名为 `xx.js`；
2. 填好 `code / name / tts(Web Speech 语音代码) / direction(书写方向) / sample`；
3. 在 `web/index.html` 引入即可。

`web/js/langs/en.js` 内已附带日语、西语示例（注释形式）。新增后，导入文档时选该语言，发音、乱序考察、阶段学习全自动适配。

---

## 六、目录结构

```
wordsteps/
├─ web/                  # 核心应用(唯一业务代码,三端共享)
│  ├─ index.html
│  ├─ css/app.css
│  ├─ js/
│  │  ├─ vendor/         # jszip.min.js / fsrs.umd.js(第三方,由 scripts/vendor.mjs 拷贝)
│  │  ├─ i18n/           # 界面语言(zh/en/…)
│  │  ├─ langs/          # 学习内容语言(en/…)
│  │  ├─ core/           # storage / parser / srs(FSRS) / wordbank / tts
│  │  ├─ ui/             # home / import / study / stats / banks / app
│  │  └─ sample-data.js  # 内置示例词库
│  └─ sample/            # 示例文档(txt/docx)
├─ desktop/              # Electron 外壳 → EXE
├─ mobile/               # Capacitor 外壳 → APK
├─ scripts/              # 打包/预览/冒烟测试脚本
└─ package.json          # 仅用于拉取第三方库(jszip / ts-fsrs)
```

## 七、技术栈

- **阶段算法**：[ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)（FSRS v6，Anki/多邻国同源的高效间隔重复算法）
- **docx 解析**：[JSZip](https://github.com/Stuk/jszip)（解压 Word 的 `word/document.xml`）
- **发音**：[sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)（WASM 离线神经 TTS）+ Piper 音色；系统 TTS / Web Speech 作为回退
- **音标**：CMUdict 词表 + ARPAbet→IPA 转换（离线，内置）
- **自定义音色**：GPT-SoVITS 零样本克隆 → Piper(VITS) 训练 → 导出 ONNX → 重打包 WASM 运行时，脚本见 `scripts/train/`
- 其余为原生 HTML/CSS/JS，无框架、无构建步骤。

---

## 八、离线语音运行时（约 105MB，不入仓库）

内置神经 TTS 的 WASM 运行时体积较大，**未纳入 Git 仓库**。首次构建前执行：

```bash
node scripts/fetch-voice-runtime.mjs
```

该脚本会自动：下载 sherpa-onnx WASM 包 → 放入 `web/js/vendor/sherpa/` → **修复模型文件名**（sherpa-onnx 代码固定读取 `./model.onnx`，而官方包的 `.data` 内是 `/en_US-xxx.onnx`，不改名会导致朗读静默失效）。

> 不执行也不影响其它功能，发音会自动回退到系统 TTS / Web Speech。

## 九、训练自定义音色（可选）

```bash
python scripts/train/train_voice.py --ref <角色音频> --name myvoice --epochs 1000
```

流程：GPT-SoVITS 零样本克隆 → 批量合成训练集 → Piper(VITS) 微调 → 导出 ONNX（补 `sample_rate` 等元数据）→ 生成配套 `tokens.txt` → `scripts/repack-sherpa-model.mjs` 重打包运行时。

相关脚本：

| 脚本 | 用途 |
| --- | --- |
| `train/train_voice.py` | 一键编排（数据集→训练→导出→重打包）|
| `train/generate_dataset.py` | GPT-SoVITS 克隆合成训练集（支持多参考音频）|
| `train/finalize_voice.py` | 训练收尾：挑最佳检查点→导出 ONNX→补元数据→生成 tokens→重打包 |
| `train/make_tokens.py` | 从模型 JSON 生成 sherpa 用的 `tokens.txt` |
| `train/add_onnx_metadata.py` | 给 ONNX 补 `sample_rate` / `n_speakers` 等元数据 |
| `train/convert_ckpt.py` | 转换 Linux 上训练的检查点供 Windows 使用 |
| `train/clean_ckpt_hparams.py` | 清理旧版检查点的超参，使其可作微调起点 |
| `train/decode_m4s.py` / `analyze_bgm.py` / `pick_refs.py` | 素材解码 / BGM 检测 / 参考片段自动挑选 |
| `tts-preview.cjs` | 用 sherpa 运行时合成试听 |
| `finish-voice.ps1` | 训练完成后全自动收尾 |

> 📌 一个已练好的示例音色（独立仓库）：[mygo-chihaya-anon-piper-sherpa-onnx-android-web-english-voice](https://github.com/dove-cyber/mygo-chihaya-anon-piper-sherpa-onnx-android-web-english-voice)

### ⚠️ 训练的三个关键经验（能省几十小时）

1. **训练步数是决定性的。**
   官方 Piper 音色训练约 **135 万步**。仅训 2~3 万步的模型 `val_mel` 看着正常（0.44），但输出会有**明显宽带噪声**——VITS 的 mel 损失很早就饱和，**噪声靠对抗(GAN)训练慢慢磨掉**。
   → 优先**从官方检查点微调**（如 `en_US-lessac-medium`），而不是从零训练；把 `max_epochs` 设大，别让学习率过早衰减到 5%。

2. **`tokens.txt` 必须与模型配套，且 sherpa 只接受单字符音素。**
   用错 tokens 会让音素→ID 错位、音素被丢弃 → 输出电流噪声（不报错，很隐蔽）。sherpa 的 `ReadTokens` 要求音素 UTF-8 解码后长度为 1，`aɪ`/`aʊ`/`eɪ`/`oʊ`/`ɔɪ` 这类合并双元音会被直接拒绝（espeak 默认本就拆开，剔除无影响）。

3. **重打包 `.data` 时务必用同一对 glue + `.data`。**
   混用（如用上次重打包的 glue 配原始 .data）会导致 espeak-ng-data 全部错位 → 同样表现为电流噪声。`repack-sherpa-model.mjs` 已内置一致性校验拦截此问题。

> 排查听感问题时，**画频谱图比看指标更直接**：宽带噪声在频谱图上一眼可见。

## 十、测试版已知说明

- APK 出包需本机 JDK 17 + Android SDK（本仓库只交付工程源码 + 打包脚本）。
- 内置神经 TTS 需先执行 `node scripts/fetch-voice-runtime.mjs` 获取运行时；未获取时自动回退系统 TTS。
- `.doc`（旧版二进制）暂不支持，请转存 `.docx`。
- 数据存于本机（浏览器 IndexedDB / 应用沙箱），清除浏览器数据会清空学习记录。

---

<div align="center">

**词阶 WordSteps** · 作者 **鸽浅.strandove**

MIT License © 2026 鸽浅.strandove

</div>

