import { app, BrowserWindow, session } from 'electron';
import path from 'path';

const isDev = !app.isPackaged;

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'NightOwl Linguist',
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Auto-grant microphone permission (Electron has no Chrome-style permission bar)
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      const allowed = ['media', 'microphone'];
      callback(allowed.includes(permission));
    }
  );

  session.defaultSession.setPermissionCheckHandler(
    (_webContents, permission) => {
      const allowed = ['media', 'microphone'];
      return allowed.includes(permission);
    }
  );

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
