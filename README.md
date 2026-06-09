# TaskLogic

**Aplicación de escritorio para gestión y planificación de proyectos**, construida con Electron y SQLite. Diseñada para equipos que necesitan crear cronogramas Gantt, controlar avances y exportar resultados a distintos formatos, todo sin depender de conexión a internet.

---

## Capturas

> *(próximamente)*

---

## Características principales

### Gestión de proyectos
- Crear proyectos con código, cliente, responsable, estado y descripción
- Dashboard con métricas de avance: completado, en proceso, vencido, observado
- Control por **fecha de control** para simulación de avance en el tiempo

### Planificador Gantt
- Actividades con dos modos: **duración en días hábiles** o **fecha fin manual**
- Cálculo automático considerando fines de semana y feriados
- Recálculo en cascada: al mover una actividad, las siguientes se ajustan
- Estados automáticos por fecha de control: `PENDIENTE`, `EN_PROCESO`, `CULMINADO`, `VENCIDO`, `OBSERVADO`

### Feriados
- Registro manual de feriados
- Importación automática desde la API pública de [Nager.Date](https://date.nager.at) (Perú)

### Exportaciones
| Formato | Descripción |
|---|---|
| **PNG** | Gantt de alta calidad (2×). Para proyectos grandes se divide en imágenes balanceadas — el usuario elige cuántas actividades por imagen. Cada imagen tiene su propio timeline ajustado. |
| **SVG** | Versión vectorial del Gantt, escalable a cualquier tamaño |
| **CSV / Excel** | Cronograma en tabla para trabajar en hojas de cálculo |
| **MS Project XML** | Formato MSPDI compatible con Microsoft Project 2010+, incluye calendario laboral (lun–vie), feriados como excepciones y todos los campos requeridos por el schema |

---

## Tecnologías

| Capa | Tecnología |
|---|---|
| Runtime de escritorio | [Electron](https://www.electronjs.org/) v41 |
| Base de datos | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (SQLite embebido) |
| Frontend | HTML + CSS + JavaScript vanilla (sin frameworks) |
| Empaquetado | [Electron Forge](https://www.electronforge.io/) |

---

## Requisitos

- **Node.js** v18 o superior
- **npm** v9 o superior
- Windows 10/11 x64

---

## Instalación y desarrollo

```bash
# Clonar el repositorio
git clone https://github.com/Jeferson0512/TaskLogic.git
cd TaskLogic

# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm start
```

---

## Compilar para distribución

```bash
# Genera la carpeta out/TaskLogic-win32-x64/ con el ejecutable
npm run build

# Build + instalador en un solo paso
npm run dist
```

El resultado es una carpeta portable con `TaskLogic.exe`. No requiere instalación en el equipo destino.

---

## Estructura del proyecto

```
TaskLogic/
├── database/
│   └── schema.sql              # Esquema SQLite (proyectos, actividades, feriados)
├── scripts/
│   ├── build.js                # Script de empaquetado personalizado
│   └── make-installer.js       # Generador de instalador
├── src/
│   ├── main/                   # Proceso principal de Electron
│   │   ├── main.js             # Entry point, creación de ventana
│   │   ├── database.js         # Inicialización y migraciones de SQLite
│   │   ├── ipc.js              # Handlers IPC (bridge main ↔ renderer)
│   │   ├── preload.js          # API expuesta al renderer (contextBridge)
│   │   └── repositories/       # Acceso a datos por entidad
│   └── renderer/               # Interfaz de usuario
│       ├── index.html          # Shell HTML principal
│       └── assets/
│           ├── css/            # Estilos por módulo
│           └── js/             # Lógica de UI por módulo
└── forge.config.js             # Configuración de Electron Forge
```

---

## Flujo de la arquitectura

```
Renderer (UI)
    │  window.api.*  (preload / contextBridge)
    ▼
Main Process  ──►  IPC Handlers  ──►  Repositories  ──►  SQLite
```

La UI nunca accede directamente a la base de datos. Todo pasa por IPC, lo que mantiene `contextIsolation: true` y el proceso renderer completamente sandboxed.

---

## Licencia

MIT — libre para uso personal y comercial.
