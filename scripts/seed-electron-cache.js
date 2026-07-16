/**
 * Siembra el caché de @electron/get usando el ZIP local ya creado.
 * Corre esto una sola vez antes de npm run package.
 */
const path = require("path");
const fs = require("fs");
const { downloadArtifact } = require("@electron/get");

const LOCAL_ZIP = path.resolve(__dirname, "../electron-cache/electron-v41.0.0-win32-x64.zip");

if (!fs.existsSync(LOCAL_ZIP)) {
    console.error("ZIP no encontrado en:", LOCAL_ZIP);
    console.error("Corre primero: Compress-Archive -Path .\\node_modules\\electron\\dist\\* -DestinationPath .\\electron-cache\\electron-v41.0.0-win32-x64.zip");
    process.exit(1);
}

console.log("ZIP local encontrado:", LOCAL_ZIP, `(${(fs.statSync(LOCAL_ZIP).size / 1024 / 1024).toFixed(1)} MB)`);
console.log("Sembrando caché de @electron/get...");

downloadArtifact({
    version: "41.0.0",
    artifactName: "electron",
    platform: "win32",
    arch: "x64",
    downloader: {
        download: async (_url, targetFilePath) => {
            fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
            fs.copyFileSync(LOCAL_ZIP, targetFilePath);
            console.log("ZIP copiado al caché en:", targetFilePath);
        },
    },
}).then((cachedPath) => {
    console.log("\nCaché sembrado exitosamente!");
    console.log("Ruta en caché:", cachedPath);
    console.log("\nAhora puedes correr: npm run package");
}).catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
});
