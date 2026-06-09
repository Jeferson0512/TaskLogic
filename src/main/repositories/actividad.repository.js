const { getDb } = require("../database");

function mapRow(row) {
    if (!row) return null;

    return {
        id: row.id,
        proyectoId: row.proyecto_id,
        orden: row.orden,
        nombre: row.nombre,
        inicio: row.inicio,
        finManual: row.fin_manual,
        duracion: row.duracion,
        tipoDia: row.tipo_dia,
        modo: row.modo,
        cuentaInicio: Boolean(row.cuenta_inicio),
        considerarFeriados: Boolean(row.considerar_feriados),
        ajustarSiguientes: Boolean(row.ajustar_siguientes),
        responsable: row.responsable,
        estado: row.estado,
    };
}

function findByProject(proyectoId) {
    return getDb()
        .prepare(`
      SELECT *
      FROM actividades
      WHERE proyecto_id = ?
      ORDER BY orden ASC
    `)
        .all(proyectoId)
        .map(mapRow);
}

function create(data) {
    const result = getDb()
        .prepare(`
      INSERT INTO actividades (
        proyecto_id,
        orden,
        nombre,
        inicio,
        fin_manual,
        duracion,
        tipo_dia,
        modo,
        cuenta_inicio,
        considerar_feriados,
        ajustar_siguientes,
        responsable,
        estado
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
        .run(
            data.proyectoId,
            data.orden,
            data.nombre,
            data.inicio,
            data.finManual || null,
            data.duracion,
            data.tipoDia,
            data.modo,
            data.cuentaInicio ? 1 : 0,
            data.considerarFeriados ? 1 : 0,
            data.ajustarSiguientes !== false ? 1 : 0,
            data.responsable,
            data.estado
        );

    return mapRow(
        getDb()
            .prepare("SELECT * FROM actividades WHERE id = ?")
            .get(result.lastInsertRowid)
    );
}

function update(id, data) {
    getDb()
        .prepare(`
      UPDATE actividades
      SET
        orden = ?,
        nombre = ?,
        inicio = ?,
        fin_manual = ?,
        duracion = ?,
        tipo_dia = ?,
        modo = ?,
        cuenta_inicio = ?,
        considerar_feriados = ?,
        ajustar_siguientes = ?,
        responsable = ?,
        estado = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
        .run(
            data.orden,
            data.nombre,
            data.inicio,
            data.finManual || null,
            data.duracion,
            data.tipoDia,
            data.modo,
            data.cuentaInicio ? 1 : 0,
            data.considerarFeriados ? 1 : 0,
            data.ajustarSiguientes !== false ? 1 : 0,
            data.responsable,
            data.estado,
            id
        );

    return true;
}

function remove(id) {
    return getDb()
        .prepare("DELETE FROM actividades WHERE id = ?")
        .run(id);
}

module.exports = {
    findByProject,
    create,
    update,
    remove,
};