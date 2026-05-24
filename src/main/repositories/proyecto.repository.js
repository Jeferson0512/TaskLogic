const { getDb } = require("../database");

function findAll() {
    return getDb()
        .prepare(`
      SELECT
        id,
        codigo,
        titulo,
        cliente,
        responsable,
        estado,
        descripcion,
        fecha_registro AS creado
      FROM proyectos
      ORDER BY id DESC
    `)
        .all();
}

function findById(id) {
    return getDb()
        .prepare(`
      SELECT
        id,
        codigo,
        titulo,
        cliente,
        responsable,
        estado,
        descripcion,
        fecha_registro AS creado
      FROM proyectos
      WHERE id = ?
    `)
        .get(id);
}

function create(data) {
    const result = getDb()
        .prepare(`
      INSERT INTO proyectos (
        codigo,
        titulo,
        cliente,
        responsable,
        estado,
        descripcion,
        fecha_registro
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
        .run(
            data.codigo,
            data.titulo,
            data.cliente,
            data.responsable,
            data.estado,
            data.descripcion,
            data.creado
        );

    return findById(result.lastInsertRowid);
}

function update(id, data) {
    getDb()
        .prepare(`
      UPDATE proyectos
      SET
        titulo = ?,
        cliente = ?,
        responsable = ?,
        estado = ?,
        descripcion = ?,
        fecha_registro = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
        .run(
            data.titulo,
            data.cliente,
            data.responsable,
            data.estado,
            data.descripcion,
            data.creado,
            id
        );

    return findById(id);
}

function remove(id) {
    return getDb()
        .prepare("DELETE FROM proyectos WHERE id = ?")
        .run(id);
}

module.exports = {
    findAll,
    findById,
    create,
    update,
    remove,
};