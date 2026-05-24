const { getDb } = require("../database");

function nextCode(entidad, prefix) {
    const db = getDb();

    const tx = db.transaction(() => {
        const row = db
            .prepare("SELECT ultimo_numero FROM secuencias WHERE entidad = ?")
            .get(entidad);

        const next = Number(row?.ultimo_numero || 0) + 1;

        db.prepare(`
      INSERT INTO secuencias (entidad, ultimo_numero)
      VALUES (?, ?)
      ON CONFLICT(entidad)
      DO UPDATE SET ultimo_numero = excluded.ultimo_numero
    `).run(entidad, next);

        return `${prefix}-${String(next).padStart(3, "0")}`;
    });

    return tx();
}

module.exports = {
    nextCode,
};