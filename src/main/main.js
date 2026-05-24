const path = require("path");
const { app, BrowserWindow } = require("electron");

const { initDatabase } = require("./database");
const { registerIpcHandlers } = require("./ipc");

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1100,
        minHeight: 720,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

    mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    try {
        initDatabase();
        registerIpcHandlers();
        createWindow();
    } catch (error) {
        console.error("Error iniciando la aplicación:", error);
        app.quit();
    }

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
