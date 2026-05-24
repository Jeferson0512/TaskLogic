function validateCreate(data) {
    if (!data.titulo || !String(data.titulo).trim()) {
        throw new Error("El título del proyecto es obligatorio.");
    }

    if (!data.estado) {
        data.estado = "PENDIENTE";
    }

    const allowed = ["PENDIENTE", "EN_PROCESO", "CULMINADO", "OBSERVADO"];

    if (!allowed.includes(data.estado)) {
        throw new Error("Estado de proyecto no válido.");
    }

    return {
        ...data,
        titulo: String(data.titulo).trim(),
        cliente: String(data.cliente || "").trim(),
        responsable: String(data.responsable || "").trim(),
        descripcion: String(data.descripcion || "").trim(),
        creado: data.creado || new Date().toISOString().slice(0, 10),
    };
}

module.exports = {
    validateCreate,
};