const { ipcMain } = require("electron");

const proyectoService = require("./services/proyecto.service");
const actividadRepository = require("./repositories/actividad.repository");
const feriadoRepository = require("./repositories/feriado.repository");

function registerIpcHandlers() {
    ipcMain.handle("proyectos:listar", () => {
        return proyectoService.listar();
    });

    ipcMain.handle("proyectos:obtener", (_event, id) => {
        return proyectoService.obtener(id);
    });

    ipcMain.handle("proyectos:guardar", (_event, data) => {
        return proyectoService.guardar(data);
    });

    ipcMain.handle("proyectos:actualizar", (_event, id, data) => {
        return proyectoService.actualizar(id, data);
    });

    ipcMain.handle("proyectos:eliminar", (_event, id) => {
        return proyectoService.eliminar(id);
    });

    ipcMain.handle("actividades:listarPorProyecto", (_event, proyectoId) => {
        return actividadRepository.findByProject(proyectoId);
    });

    ipcMain.handle("actividades:guardar", (_event, data) => {
        return actividadRepository.create(data);
    });

    ipcMain.handle("actividades:actualizar", (_event, id, data) => {
        return actividadRepository.update(id, data);
    });

    ipcMain.handle("actividades:eliminar", (_event, id) => {
        return actividadRepository.remove(id);
    });

    ipcMain.handle("feriados:listar", () => {
        return feriadoRepository.findAll();
    });

    ipcMain.handle("feriados:guardar", (_event, data) => {
        return feriadoRepository.create(data);
    });

    ipcMain.handle("feriados:eliminar", (_event, id) => {
        return feriadoRepository.remove(id);
    });
}

module.exports = {
    registerIpcHandlers,
};