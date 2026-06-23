import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const APP_ICON = path.join(__dirname, "../public/vault-logo.png");

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: "#07090f",
    titleBarStyle: "hiddenInset",
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

ipcMain.handle("dialog:openFile", async () => {
  const { dialog } = await import("electron");
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Documentos", extensions: ["pdf", "xlsx"] }],
  });
  return result.filePaths[0] ?? null;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.whenReady().then(() => {
  if (process.platform === "darwin") app.dock?.setIcon(APP_ICON);
  createWindow();
});
