/* 词阶 WordSteps 桌面版入口(Electron) */
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 800,
    minWidth: 360,
    minHeight: 600,
    title: '词阶 WordSteps',
    autoHideMenuBar: true,
    backgroundColor: '#f4f6fb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 开发时加载 ../web,打包后加载随包的 www
  const devPath = path.join(__dirname, '..', 'web', 'index.html');
  const pkgPath = path.join(__dirname, 'www', 'index.html');
  win.loadFile(app.isPackaged ? pkgPath : devPath);

  Menu.setApplicationMenu(null);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
