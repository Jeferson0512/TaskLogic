const path = require("path");
const { app, BrowserWindow, session } = require("electron");

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

    // Limpia caché al arrancar para que CSS/JS siempre estén frescos
    session.defaultSession.clearCache().then(() => {
        mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
    });

    // Intercepta teclas directamente en el webContents (más fiable que globalShortcut)
    mainWindow.webContents.on("before-input-event", (event, input) => {
        // F12 → abre/cierra DevTools
        if (input.type === "keyDown" && input.key === "F12") {
            if (mainWindow.webContents.isDevToolsOpened()) {
                mainWindow.webContents.closeDevTools();
            } else {
                mainWindow.webContents.openDevTools();
            }
            event.preventDefault();
        }

        // Ctrl+Shift+R → vacía caché y recarga
        if (input.type === "keyDown" && input.key === "R" && input.control && input.shift) {
            session.defaultSession.clearCache().then(() => {
                mainWindow.webContents.reload();
            });
            event.preventDefault();
        }
    });
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
