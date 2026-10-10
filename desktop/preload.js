/* 预加载脚本:预留原生能力桥接(文件系统、系统通知等),当前仅暴露基础信息 */
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('wordsteps', {
  version: '0.1.0',
  platform: process.platform,
});
