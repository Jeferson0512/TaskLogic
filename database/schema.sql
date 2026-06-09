PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS secuencias (
  entidad TEXT PRIMARY KEY,
  ultimo_numero INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS proyectos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  cliente TEXT,
  responsable TEXT,
  estado TEXT NOT NULL DEFAULT 'PENDIENTE',
  descripcion TEXT,
  fecha_registro TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS actividades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proyecto_id INTEGER NOT NULL,
  orden INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  inicio TEXT NOT NULL,
  fin_manual TEXT,
  duracion INTEGER NOT NULL DEFAULT 1,
  tipo_dia TEXT NOT NULL DEFAULT 'HABIL',
  modo TEXT NOT NULL DEFAULT 'DURACION',
  cuenta_inicio INTEGER NOT NULL DEFAULT 1,
  considerar_feriados INTEGER NOT NULL DEFAULT 1,
  ajustar_siguientes INTEGER NOT NULL DEFAULT 1,
  responsable TEXT,
  estado TEXT NOT NULL DEFAULT 'PENDIENTE',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,

  FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS feriados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO secuencias (entidad, ultimo_numero)
VALUES ('PROYECTO', 0);

CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

INSERT OR IGNORE INTO configuracion (clave, valor)
VALUES ('admin_password', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918');