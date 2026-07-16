/**
 * Script de seed: inserta un proyecto demo con 18 actividades completadas
 * distribuidas en 7 meses para probar la exportación PNG del planificador.
 *
 * Uso: node scripts/seed-demo.js
 */

const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = path.join(
    process.env.APPDATA,
    "tasklogic",
    "tasklogic.sqlite"
);

const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");

// ── Proyecto ────────────────────────────────────────────────────────────────
const proyecto = {
    codigo:          "PLN-2025-001",
    titulo:          "Construcción Centro Logístico Norte",
    cliente:         "Distribuidora Ronchi S.A.",
    responsable:     "Jeferson Bujaico",
    estado:          "COMPLETADO",
    descripcion:     "Proyecto de construcción e implementación de centro logístico de 3 500 m², incluyendo obra civil, instalaciones y equipamiento.",
    fecha_registro:  "2025-08-01",
};

// ── Actividades (18) distribuidas Aug 2025 → Feb 2026 ───────────────────────
// Campos: orden, nombre, inicio, fin_manual, duracion, tipo_dia, modo,
//         cuenta_inicio, considerar_feriados, ajustar_siguientes, responsable, estado
const actividades = [
    // MES 1 — Agosto 2025
    { orden: 1,  nombre: "Estudio de Factibilidad",         inicio: "2025-08-01", fin_manual: "2025-08-15", duracion: 11, responsable: "Arq. Pérez"   },
    { orden: 2,  nombre: "Levantamiento Topográfico",       inicio: "2025-08-11", fin_manual: "2025-08-22", duracion:  9, responsable: "Ing. Torres"  },
    { orden: 3,  nombre: "Diseño Conceptual y Planos",      inicio: "2025-08-18", fin_manual: "2025-09-05", duracion: 15, responsable: "Arq. Pérez"   },

    // MES 2 — Septiembre 2025
    { orden: 4,  nombre: "Gestión de Permisos y Licencias", inicio: "2025-09-01", fin_manual: "2025-09-19", duracion: 15, responsable: "Adm. Flores"  },
    { orden: 5,  nombre: "Aprobación de Planos",            inicio: "2025-09-08", fin_manual: "2025-09-19", duracion: 10, responsable: "Ing. Vargas"  },
    { orden: 6,  nombre: "Adquisición de Materiales",       inicio: "2025-09-22", fin_manual: "2025-10-03", duracion: 10, responsable: "Log. Ríos"    },

    // MES 3 — Octubre 2025
    { orden: 7,  nombre: "Preparación del Terreno",         inicio: "2025-10-01", fin_manual: "2025-10-17", duracion: 13, responsable: "Ing. Torres"  },
    { orden: 8,  nombre: "Obra Civil — Cimientos",          inicio: "2025-10-13", fin_manual: "2025-11-07", duracion: 20, responsable: "Ing. Vargas"  },

    // MES 4 — Noviembre 2025
    { orden: 9,  nombre: "Estructura Metálica",             inicio: "2025-11-03", fin_manual: "2025-11-28", duracion: 20, responsable: "Ing. Castro"  },
    { orden: 10, nombre: "Instalaciones Eléctricas",        inicio: "2025-11-10", fin_manual: "2025-12-05", duracion: 20, responsable: "Elec. Mora"   },
    { orden: 11, nombre: "Instalaciones Hidráulicas",       inicio: "2025-11-17", fin_manual: "2025-12-12", duracion: 20, responsable: "Plom. Díaz"   },

    // MES 5 — Diciembre 2025
    { orden: 12, nombre: "Cerramiento y Muros Exteriores",  inicio: "2025-12-01", fin_manual: "2025-12-19", duracion: 15, responsable: "Ing. Castro"  },
    { orden: 13, nombre: "Techumbre y Cubierta",            inicio: "2025-12-08", fin_manual: "2026-01-09", duracion: 25, responsable: "Arq. Pérez"   },

    // MES 6 — Enero 2026
    { orden: 14, nombre: "Acabados Interiores",             inicio: "2026-01-05", fin_manual: "2026-01-30", duracion: 20, responsable: "Arq. Lamas"   },
    { orden: 15, nombre: "Sistema Contraincendios",         inicio: "2026-01-12", fin_manual: "2026-01-30", duracion: 15, responsable: "Seg. Huanca"  },
    { orden: 16, nombre: "Señalización y Seguridad",        inicio: "2026-01-19", fin_manual: "2026-02-06", duracion: 15, responsable: "Seg. Huanca"  },

    // MES 7 — Febrero 2026
    { orden: 17, nombre: "Equipamiento e Instalación de Racks", inicio: "2026-02-02", fin_manual: "2026-02-20", duracion: 15, responsable: "Log. Ríos"  },
    { orden: 18, nombre: "Pruebas, Capacitación y Entrega",      inicio: "2026-02-09", fin_manual: "2026-02-27", duracion: 15, responsable: "Ing. Vargas" },
];

// ── Insertar ─────────────────────────────────────────────────────────────────
const insertProyecto = db.prepare(`
    INSERT INTO proyectos (codigo, titulo, cliente, responsable, estado, descripcion, fecha_registro)
    VALUES (@codigo, @titulo, @cliente, @responsable, @estado, @descripcion, @fecha_registro)
`);

const insertActividad = db.prepare(`
    INSERT INTO actividades
        (proyecto_id, orden, nombre, inicio, fin_manual, duracion, tipo_dia, modo,
         cuenta_inicio, considerar_feriados, ajustar_siguientes, responsable, estado)
    VALUES
        (@proyecto_id, @orden, @nombre, @inicio, @fin_manual, @duracion, @tipo_dia, @modo,
         @cuenta_inicio, @considerar_feriados, @ajustar_siguientes, @responsable, @estado)
`);

const run = db.transaction(() => {
    const { lastInsertRowid: proyectoId } = insertProyecto.run(proyecto);
    console.log(`Proyecto creado con ID: ${proyectoId}`);

    for (const act of actividades) {
        insertActividad.run({
            proyecto_id:         proyectoId,
            orden:               act.orden,
            nombre:              act.nombre,
            inicio:              act.inicio,
            fin_manual:          act.fin_manual,
            duracion:            act.duracion,
            tipo_dia:            "HABIL",
            modo:                "FIN_MANUAL",
            cuenta_inicio:       1,
            considerar_feriados: 1,
            ajustar_siguientes:  1,
            responsable:         act.responsable,
            estado:              "CULMINADO",
        });
    }

    console.log(`${actividades.length} actividades insertadas.`);
    console.log("Proyecto listo para visualizar en el planificador.");
});

run();
db.close();
