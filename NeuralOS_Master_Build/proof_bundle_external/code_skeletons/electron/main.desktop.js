// main.desktop.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Choose shell via env: SHELL_MODE = winshadow|neuralmac|neurallinux
  const shell = process.env.SHELL_MODE || 'winshadow';
  win.loadFile(path.join(__dirname, `../../packages/shells/${shell}/index.html`));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
