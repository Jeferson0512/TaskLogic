"""
Seed: inserta un proyecto demo con 18 actividades completadas (7 meses).
Uso: python scripts/seed-demo.py
"""

import sqlite3
import os

DB_PATH = os.path.join(os.environ["APPDATA"], "tasklogic", "tasklogic.sqlite")

proyecto = {
    "codigo":         "PLN-2025-001",
    "titulo":         "Construcción Centro Logístico Norte",
    "cliente":        "Distribuidora Ronchi S.A.",
    "responsable":    "Jeferson Bujaico",
    "estado":         "COMPLETADO",
    "descripcion":    "Proyecto de construcción e implementación de centro logístico de 3 500 m², incluyendo obra civil, instalaciones y equipamiento.",
    "fecha_registro": "2025-08-01",
}

actividades = [
    # MES 1 — Agosto 2025
    (1,  "Estudio de Factibilidad",          "2025-08-01", "2025-08-15", 11, "Arq. Pérez"),
    (2,  "Levantamiento Topográfico",        "2025-08-11", "2025-08-22",  9, "Ing. Torres"),
    (3,  "Diseño Conceptual y Planos",       "2025-08-18", "2025-09-05", 15, "Arq. Pérez"),
    # MES 2 — Septiembre 2025
    (4,  "Gestión de Permisos y Licencias",  "2025-09-01", "2025-09-19", 15, "Adm. Flores"),
    (5,  "Aprobación de Planos",             "2025-09-08", "2025-09-19", 10, "Ing. Vargas"),
    (6,  "Adquisición de Materiales",        "2025-09-22", "2025-10-03", 10, "Log. Ríos"),
    # MES 3 — Octubre 2025
    (7,  "Preparación del Terreno",          "2025-10-01", "2025-10-17", 13, "Ing. Torres"),
    (8,  "Obra Civil — Cimientos",           "2025-10-13", "2025-11-07", 20, "Ing. Vargas"),
    # MES 4 — Noviembre 2025
    (9,  "Estructura Metálica",              "2025-11-03", "2025-11-28", 20, "Ing. Castro"),
    (10, "Instalaciones Eléctricas",         "2025-11-10", "2025-12-05", 20, "Elec. Mora"),
    (11, "Instalaciones Hidráulicas",        "2025-11-17", "2025-12-12", 20, "Plom. Díaz"),
    # MES 5 — Diciembre 2025
    (12, "Cerramiento y Muros Exteriores",   "2025-12-01", "2025-12-19", 15, "Ing. Castro"),
    (13, "Techumbre y Cubierta",             "2025-12-08", "2026-01-09", 25, "Arq. Pérez"),
    # MES 6 — Enero 2026
    (14, "Acabados Interiores",              "2026-01-05", "2026-01-30", 20, "Arq. Lamas"),
    (15, "Sistema Contraincendios",          "2026-01-12", "2026-01-30", 15, "Seg. Huanca"),
    (16, "Señalización y Seguridad",         "2026-01-19", "2026-02-06", 15, "Seg. Huanca"),
    # MES 7 — Febrero 2026
    (17, "Equipamiento e Instalación de Racks", "2026-02-02", "2026-02-20", 15, "Log. Ríos"),
    (18, "Pruebas, Capacitación y Entrega",     "2026-02-09", "2026-02-27", 15, "Ing. Vargas"),
]

con = sqlite3.connect(DB_PATH)
con.execute("PRAGMA foreign_keys = ON")
cur = con.cursor()

cur.execute("""
    INSERT INTO proyectos (codigo, titulo, cliente, responsable, estado, descripcion, fecha_registro)
    VALUES (:codigo, :titulo, :cliente, :responsable, :estado, :descripcion, :fecha_registro)
""", proyecto)

proyecto_id = cur.lastrowid
print(f"Proyecto creado con ID: {proyecto_id}")

for orden, nombre, inicio, fin_manual, duracion, responsable in actividades:
    cur.execute("""
        INSERT INTO actividades
            (proyecto_id, orden, nombre, inicio, fin_manual, duracion, tipo_dia, modo,
             cuenta_inicio, considerar_feriados, ajustar_siguientes, responsable, estado)
        VALUES
            (?, ?, ?, ?, ?, ?, 'HABIL', 'FIN_MANUAL', 1, 1, 1, ?, 'CULMINADO')
    """, (proyecto_id, orden, nombre, inicio, fin_manual, duracion, responsable))

con.commit()
con.close()
print(f"{len(actividades)} actividades insertadas.")
print("Proyecto listo — ábrelo en el planificador y exporta el PNG.")
