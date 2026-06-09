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

function importFromList(list) {
    const db = getDb();
    const stmt = db.prepare(`INSERT OR IGNORE INTO feriados (fecha, nombre) VALUES (?, ?)`);
    let importados = 0;
    const run = db.transaction((items) => {
        for (const item of items) {
            const result = stmt.run(item.fecha, item.nombre);
            if (result.changes > 0) importados++;
        }
    });
    run(list);
    return { importados, omitidos: list.length - importados };
}

module.exports = {
    findAll,
    create,
    remove,
    importFromList,
};