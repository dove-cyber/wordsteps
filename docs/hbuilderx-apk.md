# 用 HBuilderX 把「词阶」云打包成 APK(无需本地 Android SDK)

HBuilderX 的「原生App-云打包」由 DCloud 服务器代你编译,本机**不需要** JDK / Android SDK,只要登录 DCloud 账号即可。适用于 `web/` 这种纯 HTML 应用(走「5+App」运行时)。

## 一、安装 HBuilderX

1. 解压 `toolchain/HBuilderX.5.26.2026091802.zip`;
2. 双击 `HBuilderX.exe` 首次启动(选择「不导入」即可);
3. 顶部「帮助 → 登录」注册/登录 DCloud 账号(云打包必需)。

## 二、新建 5+App 项目

1. 「文件 → 新建 → 项目」;
2. 左侧选 **5+App**,选「空模板」,项目名填 `wordsteps-app`,路径自选;
3. 生成后项目里自带 `manifest.json`(含自动分配的 appid)和 `index.html`。

## 三、把词阶的页面塞进去

把 `wordsteps/web/` 目录下的**全部内容**(`index.html`、`css/`、`js/`、`sample/`)复制到该 5+App 项目的根目录,**覆盖**自带的 `index.html`。**保留 `manifest.json` 不要动**(它记录了 appid)。

## 四、配置 manifest

双击项目的 `manifest.json` → 可视化界面里填:
- 应用名称:`词阶 WordSteps`
- 版本号 / 版本名称:0.1.0
- 应用图标:上传 3 张 PNG(102×102、120×120、152×152 或直接用默认)
- 页面入口:确认为 `index.html`

## 五、云打包出 APK

1. 菜单「发行 → 原生App-云打包」;
2. 勾选 **Android**;
3. Android 包名填 `com.wordsteps.app`(证书用「公共测试证书」即可先跑通);
4. 点「打包」,等待 DCloud 云端编译;
5. 完成后会给出 APK 下载链接,下载即得 `.apk` 文件。

## 备注

- 云打包免费额度有限(每天/每月有次数限制),正式发布可购买打包次数或用「公共测试证书」自测。
- 需要正式上架/真机安装时,再在 manifest 里配置自有签名证书。
- 词阶用的是纯前端 + 本地存储(IndexedDB),不依赖后端,5+App 运行时可直接跑。
