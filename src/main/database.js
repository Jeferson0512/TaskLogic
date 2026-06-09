const path = require("path");
const fs = require("fs");
const { app } = require("electron");
const Database = require("better-sqlite3");

let db = null;

function getDatabasePath() {
    const userData = app.getPath("userData");
    return path.join(userData, "tasklogic.sqlite");
}

function getSchemaPath() {
    return path.join(__dirname, "../../database/schema.sql");
}

function initDatabase() {
    const dbPath = getDatabasePath();
    db = new Database(dbPath);

    db.pragma("foreign_keys = ON");

    const schema = fs.readFileSync(getSchemaPath(), "utf8");
    db.exec(schema);

    // Migraciones: agregar columnas nuevas a BDs ya existentes sin destruirlas
    runMigrations(db);

    return db;
}

// Registro de migraciones — agregar aquí nuevas entradas cuando cambie el esquema.
// Nunca modificar ni eliminar las existentes, solo agregar al final con el siguiente ID.
const MIGRATIONS = [
    { id: 1, sql: "ALTER TABLE actividades ADD COLUMN ajustar_siguientes INTEGER NOT NULL DEFAULT 1" },
    // { id: 2, sql: "ALTER TABLE proyectos ADD COLUMN nueva_columna TEXT" },
    // { id: 3, sql: "ALTER TABLE actividades ADD COLUMN otra_columna INTEGER NOT NULL DEFAULT 0" },
];

function runMigrations(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS _migraciones (
            id      INTEGER PRIMARY KEY,
            aplicada_en TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const aplicadas = new Set(
        db.prepare("SELECT id FROM _migraciones").all().map((r) => r.id)
    );

    for (const { id, sql } of MIGRATIONS) {
        if (aplicadas.has(id)) continue;
        try {
            db.prepare(sql).run();
            db.prepare("INSERT INTO _migraciones (id) VALUES (?)").run(id);
        } catch (err) {
            console.error(`Migración ${id} falló:`, err.message);
        }
    }
}

function getDb() {
    if (!db) return initDatabase();
    return db;
}

module.exports = {
    initDatabase,
    getDb,
    getDatabasePath,
};