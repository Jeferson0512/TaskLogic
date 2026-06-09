const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    proyectos: {
        listar: () => ipcRenderer.invoke("proyectos:listar"),
        obtener: (id) => ipcRenderer.invoke("proyectos:obtener", id),
        guardar: (data) => ipcRenderer.invoke("proyectos:guardar", data),
        actualizar: (id, data) => ipcRenderer.invoke("proyectos:actualizar", id, data),
        eliminar: (id) => ipcRenderer.invoke("proyectos:eliminar", id),
    },

    actividades: {
        listarPorProyecto: (proyectoId) =>
            ipcRenderer.invoke("actividades:listarPorProyecto", proyectoId),

        guardar: (data) =>
            ipcRenderer.invoke("actividades:guardar", data),

        actualizar: (id, data) =>
            ipcRenderer.invoke("actividades:actualizar", id, data),

        eliminar: (id) =>
            ipcRenderer.invoke("actividades:eliminar", id),
    },

    feriados: {
        listar: () => ipcRenderer.invoke("feriados:listar"),
        guardar: (data) => ipcRenderer.invoke("feriados:guardar", data),
        eliminar: (id) => ipcRenderer.invoke("feriados:eliminar", id),
        importarDeApi: (año) => ipcRenderer.invoke("feriados:importarDeApi", año),
    },

    db: {
        exportar: (password, format) => ipcRenderer.invoke("db:exportar", password, format),
    },
});