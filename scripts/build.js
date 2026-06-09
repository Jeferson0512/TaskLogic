/**
 * Build manual de TaskLogic para Windows x64.
 * Bypasea electron-packager y @electron/get completamente.
 * Usa el Electron ya instalado en node_modules/electron/dist/.
 */
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "..");
const ELECTRON_DIST = path.join(ROOT, "node_modules", "electron", "dist");
const OUT_DIR = path.join(ROOT, "out", "TaskLogic-win32-x64");
const APP_DIR = path.join(OUT_DIR, "resources", "app");

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function collectDeps(pkgDir, collected = new Set()) {
    try {
        const pkgJson = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));
        for (const dep of Object.keys(pkgJson.dependencies || {})) {
            if (collected.has(dep)) continue;
            collected.add(dep);
            const depDir = path.join(ROOT, "node_modules", dep);
            if (fs.existsSync(depDir)) collectDeps(depDir, collected);
        }
    } catch (_) {}
    return collected;
}

// --- Build ---

console.log("=== TaskLogic Build ===\n");

// 1. Limpiar output anterior
if (fs.existsSync(OUT_DIR)) {
    console.log("Limpiando output anterior...");
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
}
fs.mkdirSync(OUT_DIR, { recursive: true });

// 2. Copiar binarios de Electron
console.log("Copiando Electron desde node_modules/electron/dist/ ...");
copyDir(ELECTRON_DIST, OUT_DIR);

// 3. Renombrar electron.exe -> TaskLogic.exe
fs.renameSync(path.join(OUT_DIR, "electron.exe"), path.join(OUT_DIR, "TaskLogic.exe"));
console.log("  electron.exe -> TaskLogic.exe");

// 4. Crear estructura de la app
fs.mkdirSync(APP_DIR, { recursive: true });

// 5. Copiar archivos de la app
console.log("Copiando archivos de la app...");
for (const dir of ["src", "database"]) {
    copyDir(path.join(ROOT, dir), path.join(APP_DIR, dir));
    console.log("  " + dir + "/");
}
fs.copyFileSync(path.join(ROOT, "package.json"), path.join(APP_DIR, "package.json"));
console.log("  package.json");

// 6. Copiar node_modules de producción
console.log("\nResolviendo dependencias de producción...");
const deps = collectDeps(ROOT);
console.log("  Dependencias:", [...deps].join(", "));

const nmOut = path.join(APP_DIR, "node_modules");
fs.mkdirSync(nmOut, { recursive: true });
for (const dep of deps) {
    const src = path.join(ROOT, "node_modules", dep);
    const dest = path.join(nmOut, dep);
    if (fs.existsSync(src)) {
        process.stdout.write("  Copiando " + dep + "...");
        copyDir(src, dest);
        console.log(" OK");
    } else {
        console.warn("  AVISO: " + dep + " no encontrado");
    }
}

console.log("\n=== Build completado! ===");
console.log("Directorio: " + OUT_DIR);
console.log("Ejecutar:   " + path.join(OUT_DIR, "TaskLogic.exe"));
