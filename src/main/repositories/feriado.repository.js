const { getDb } = require("../database");

function findAll() {
    return getDb()
        .prepare(`
      SELECT id, fecha, nombre
      FROM feriados
      ORDER BY fecha ASC
    `)
        .all();
}

function create(data) {
    const result = getDb()
        .prepare(`
      INSERT INTO feriados (fecha, nombre)
      VALUES (?, ?)
    `)
        .run(data.fecha, data.nombre);

    return {
        id: result.lastInsertRowid,
        fecha: data.fecha,
        nombre: data.nombre,
    };
}

function remove(id) {
    return getDb()
        .prepare("DELETE FROM feriados WHERE id = ?")
        .run(id);
}

module.exports = {
    findAll,
    create,
    remove,
};