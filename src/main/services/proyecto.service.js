const proyectoRepository = require("../repositories/proyecto.repository");
const secuenciaRepository = require("../repositories/secuencia.repository");
const proyectoValidator = require("../validators/proyecto.validator");
const actividadRepository = require("../repositories/actividad.repository");

function listar() {
    const proyectos = proyectoRepository.findAll();

    return proyectos.map((project) => ({
        ...project,
        actividades: actividadRepository.findByProject(project.id),
    }));
}

function obtener(id) {
    const project = proyectoRepository.findById(id);
    if (!project) return null;

    return {
        ...project,
        actividades: actividadRepository.findByProject(project.id),
    };
}

function guardar(data) {
    const cleaned = proyectoValidator.validateCreate(data);

    const codigo = secuenciaRepository.nextCode("PROYECTO", "PRY");

    return proyectoRepository.create({
        ...cleaned,
        codigo,
    });
}

function actualizar(id, data) {
    const cleaned = proyectoValidator.validateCreate(data);
    return proyectoRepository.update(id, cleaned);
}

function eliminar(id) {
    proyectoRepository.remove(id);
    return true;
}

module.exports = {
    listar,
    obtener,
    guardar,
    actualizar,
    eliminar,
};