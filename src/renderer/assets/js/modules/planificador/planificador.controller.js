window.PlanificadorController = (() => {
    async function render(projectId) {
        const project = await Api.proyectos.obtener(projectId);
        const actividades = await Api.actividades.listarPorProyecto(projectId);
    }

    function bindEvents() { }

    return { render };
})();