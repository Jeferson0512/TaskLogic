const { ipcMain, dialog } = require("electron");
const crypto = require("crypto");
const fs = require("fs");
const https = require("https");

const proyectoService = require("./services/proyecto.service");
const actividadRepository = require("./repositories/actividad.repository");
const feriadoRepository = require("./repositories/feriado.repository");
const { getDb, getDatabasePath } = require("./database");

const EXPORT_TABLES = ["secuencias", "proyectos", "actividades", "feriados", "configuracion"];

function generateSqlDump(db, format) {
    const isMySQL = format === "mysql";
    const q = isMySQL ? "`" : '"';
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);

    let sql = `-- TaskLogic Database Export\n-- Generated: ${now}\n-- Format: ${isMySQL ? "MySQL / MariaDB" : "SQL (SQLite / PostgreSQL)"}\n\n`;

    if (isMySQL) {
        sql += "SET FOREIGN_KEY_CHECKS=0;\nSET NAMES utf8mb4;\n\n";
    } else {
        sql += "PRAGMA foreign_keys = OFF;\nBEGIN TRANSACTION;\n\n";
    }

    for (const table of EXPORT_TABLES) {
        const rows = db.prepare(`SELECT * FROM "${table}"`).all();
        if (rows.length === 0) continue;

        const cols = Object.keys(rows[0]);
        const colList = cols.map((c) => `${q}${c}${q}`).join(", ");

        sql += isMySQL
            ? `TRUNCATE TABLE ${q}${table}${q};\n`
            : `DELETE FROM ${q}${table}${q};\n`;

        for (const row of rows) {
            const vals = cols.map((c) => {
                const v = row[c];
                if (v === null || v === undefined) return "NULL";
                if (typeof v === "number") return v;
                return `'${String(v).replace(/'/g, "''")}'`;
            }).join(", ");
            sql += `INSERT INTO ${q}${table}${q} (${colList}) VALUES (${vals});\n`;
        }
        sql += "\n";
    }

    if (isMySQL) {
        sql += "SET FOREIGN_KEY_CHECKS=1;\n";
    } else {
        sql += "COMMIT;\nPRAGMA foreign_keys = ON;\n";
    }

    return sql;
}

function registerIpcHandlers() {
    ipcMain.handle("proyectos:listar", () => {
        return proyectoService.listar();
    });

    ipcMain.handle("proyectos:obtener", (_event, id) => {
        return proyectoService.obtener(id);
    });

    ipcMain.handle("proyectos:guardar", (_event, data) => {
        return proyectoService.guardar(data);
    });

    ipcMain.handle("proyectos:actualizar", (_event, id, data) => {
        return proyectoService.actualizar(id, data);
    });

    ipcMain.handle("proyectos:eliminar", (_event, id) => {
        return proyectoService.eliminar(id);
    });

    ipcMain.handle("actividades:listarPorProyecto", (_event, proyectoId) => {
        return actividadRepository.findByProject(proyectoId);
    });

    ipcMain.handle("actividades:guardar", (_event, data) => {
        return actividadRepository.create(data);
    });

    ipcMain.handle("actividades:actualizar", (_event, id, data) => {
        return actividadRepository.update(id, data);
    });

    ipcMain.handle("actividades:eliminar", (_event, id) => {
        return actividadRepository.remove(id);
    });

    ipcMain.handle("feriados:listar", () => {
        return feriadoRepository.findAll();
    });

    ipcMain.handle("feriados:guardar", (_event, data) => {
        return feriadoRepository.create(data);
    });

    ipcMain.handle("feriados:eliminar", (_event, id) => {
        return feriadoRepository.remove(id);
    });

    ipcMain.handle("feriados:importarDeApi", (_event, año) => {
        return new Promise((resolve) => {
            const url = `https://date.nager.at/api/v3/PublicHolidays/${año}/PE`;
            https.get(url, (res) => {
                let raw = "";
                res.on("data", (chunk) => { raw += chunk; });
                res.on("end", () => {
                    try {
                        if (res.statusCode !== 200) {
                            resolve({ success: false, error: `HTTP ${res.statusCode}` });
                            return;
                        }
                        const list = JSON.parse(raw).map((h) => ({
                            fecha: h.date,
                            nombre: h.localName || h.name,
                        }));
                        const result = feriadoRepository.importFromList(list);
                        resolve({ success: true, ...result, total: list.length });
                    } catch (e) {
                        resolve({ success: false, error: e.message });
                    }
                });
            }).on("error", (e) => {
                resolve({ success: false, error: e.message });
            });
        });
    });

    ipcMain.handle("db:exportar", async (_event, password, format) => {
        const hash = crypto.createHash("sha256").update(password).digest("hex");
        const row = getDb().prepare("SELECT valor FROM configuracion WHERE clave = ?").get("admin_password");
        if (!row || row.valor !== hash) return { success: false };

        const isSqlite = format === "sqlite";
        const saveResult = await dialog.showSaveDialog({
            title: "Exportar base de datos TaskLogic",
            defaultPath: isSqlite ? "tasklogic_backup.sqlite" : "tasklogic_backup.sql",
            filters: isSqlite
                ? [{ name: "SQLite Database", extensions: ["sqlite", "db"] }]
                : [{ name: "SQL Script", extensions: ["sql"] }],
        });
        if (saveResult.canceled || !saveResult.filePath) return { success: false };

        if (isSqlite) {
            await getDb().backup(saveResult.filePath);
        } else {
            const sql = generateSqlDump(getDb(), format);
            fs.writeFileSync(saveResult.filePath, sql, "utf8");
        }

        return { success: true, path: saveResult.filePath };
    });
}

module.exports = {
    registerIpcHandlers,
};