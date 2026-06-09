/**
 * Compila el instalador .exe usando Inno Setup.
 * Requiere tener Inno Setup 6 instalado: https://jrsoftware.org/isdl.php
 */
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "..");
const ISS_FILE = path.join(ROOT, "installer", "tasklogic.iss");
const OUT_DIR = path.join(ROOT, "out", "TaskLogic-win32-x64");
const INSTALLER_OUT = path.join(ROOT, "out", "installer");

const ISCC_PATHS = [
    "C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe",
    "C:\\Program Files\\Inno Setup 6\\ISCC.exe",
    "C:\\Program Files (x86)\\Inno Setup 5\\ISCC.exe",
    "C:\\Program Files\\Inno Setup 5\\ISCC.exe",
];

// Buscar Inno Setup
const iscc = ISCC_PATHS.find(fs.existsSync);
if (!iscc) {
    console.error("\nInno Setup no encontrado.");
    console.error("Descárgalo gratis desde: https://jrsoftware.org/isdl.php");
    console.error("Instálalo y vuelve a correr: npm run installer\n");
    process.exit(1);
}

// Verificar que el build existe
if (!fs.existsSync(OUT_DIR)) {
    console.error("\nno existe out\\TaskLogic-win32-x64\\");
    console.error("Corre primero: npm run build\n");
    process.exit(1);
}

// Crear carpeta de salida del instalador
fs.mkdirSync(INSTALLER_OUT, { recursive: true });

console.log("=== Compilando instalador con Inno Setup ===\n");
console.log("Script:  " + ISS_FILE);
console.log("Salida:  " + INSTALLER_OUT);
console.log("");

try {
    execSync(`"${iscc}" "${ISS_FILE}"`, { stdio: "inherit" });
    console.log("\n=== Instalador creado exitosamente! ===");
    console.log("Archivo: " + path.join(INSTALLER_OUT, "TaskLogicSetup.exe"));
} catch (err) {
    console.error("\nError al compilar el instalador:", err.message);
    process.exit(1);
}
