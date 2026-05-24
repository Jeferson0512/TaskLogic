window.Api = (() => {
    const hasElectronApi = Boolean(window.api);

    const memory = {
        projects: [],
        holidays: [],
    };

    return {
        proyectos: {
            listar: async () => {
                if (hasElectronApi) return window.api.proyectos.listar();
                return memory.projects;
            },

            obtener: async (id) => {
                if (hasElectronApi) return window.api.proyectos.obtener(id);
                return memory.projects.find((p) => String(p.id) === String(id));
            },

            guardar: async (data) => {
                if (hasElectronApi) return window.api.proyectos.guardar(data);
                memory.projects.push(data);
                return data;
            },

            actualizar: async (id, data) => {
                if (hasElectronApi) return window.api.proyectos.actualizar(id, data);
                memory.projects = memory.projects.map((p) =>
                    String(p.id) === String(id) ? { ...p, ...data } : p
                );
                return data;
            },

            eliminar: async (id) => {
                if (hasElectronApi) return window.api.proyectos.eliminar(id);
                memory.projects = memory.projects.filter((p) => String(p.id) !== String(id));
                return true;
            },
        },

        actividades: {
            listarPorProyecto: async (proyectoId) => {
                if (hasElectronApi) {
                    return window.api.actividades.listarPorProyecto(proyectoId);
                }

                const project = memory.projects.find((p) => String(p.id) === String(proyectoId));
                return project?.actividades || [];
            },
        },

        feriados: {
            listar: async () => {
                if (hasElectronApi) return window.api.feriados.listar();
                return memory.holidays;
            },
        },
    };
})();