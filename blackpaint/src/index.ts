import { app, BrowserWindow, ipcMain, shell, nativeImage } from 'electron';
import path from 'path';
// File synchronization has been removed. The desktop app now only downloads
// files when requested and does not keep local changes in sync.
// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = (): void => {
  // Create the browser window.
  const iconFilename =
    process.platform === 'win32'
      ? 'e-logo.ico'
      : process.platform === 'darwin'
        ? 'e-logo.icns'
        : 'e-logo.png';

  const iconPath = path.join(app.getAppPath(), 'assets', iconFilename);
  const icon = nativeImage.createFromPath(iconPath);

  const mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    icon,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  if (process.platform === 'darwin') {
    app.dock.setIcon(icon);
  }

  // and load the index.html of the app.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://192.168.5.107:3001';
  const appUrl = process.env.RESTRICTED ? `${baseUrl}?restricted=1` : baseUrl;
  mainWindow.loadURL(appUrl);

  // Open the DevTools automatically when running in development.
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.

app.on('ready', () => {

  // This is our new "backend" logic
  ipcMain.handle('open-task-folder', async (_, relativePath: string) => {
    try {
      const DEFAULT_SMB_ROOT = "\\\\FWQ88\\Estara";
      const smbRoot = process.env.SMB_CLIENT_ROOT || DEFAULT_SMB_ROOT;
      const fullPath = path.join(smbRoot, relativePath);
      const openError = await shell.openPath(fullPath);
      if (openError) {
        throw new Error(openError);
      }
    } catch (err) {
      console.error('open-task-folder failed:', err);
      throw err;
    }
  });

  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});



app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
