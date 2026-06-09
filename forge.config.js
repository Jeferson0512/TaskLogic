module.exports = {
  packagerConfig: {
    asar: false,
    executableName: "TaskLogic",
    name: "TaskLogic",
    // Evita descargar Electron desde GitHub — usa el ZIP local ya creado
    electronZipDir: "./electron-cache",
  },

  rebuildConfig: {
    onlyModules: [],
  },

  makers: [
    // Portable Windows build (.zip con TaskLogic.exe dentro)
    {
      name: "@electron-forge/maker-zip",
      platforms: ["win32"],
    },
  ],

  plugins: [],
};