/**
 * dashboard-proyectos.js
 * Control principal del módulo:
 * - dashboard de proyectos
 * - modal crear/editar proyecto
 * - navegación hacia planificador
 */
window.DashboardProyectos = (() => {
  const App = window.App;
  const Planificador = window.Planificador;

  // const fallbackState = {
  //   controlDate: App.DEFAULT_CONTROL_DATE,
  //   holidays: window.PlanificacionSeed.holidays,
  //   projects: window.PlanificacionSeed.projects,
  //   currentView: "dashboard",
  //   selectedProjectId: null,
  // };

  // const state = App.loadState(fallbackState);
  const state = {
    controlDate: App.DEFAULT_CONTROL_DATE,
    holidays: [],
    projects: [],
    currentView: "dashboard",
    selectedProjectId: null,
  };
  state.currentView = "dashboard";
  state.selectedProjectId = null;

  const app = document.getElementById("app");

  let projectModalMode = "CREATE";
  let projectForm = null;
  let uiState = { query: sessionStorage.getItem("projectQuery") || "", sortBy: "reciente", page: 1 };
  const PER_PAGE = 6;

  function persistAndRender() {
    App.saveState({
      controlDate: state.controlDate,
      holidays: state.holidays,
      projects: state.projects,
    });

    render();
  }

  function render() {
    if (state.currentView === "planner" && state.selectedProjectId) {
      Planificador.renderPlanner(app, state.selectedProjectId);
    } else {
      renderDashboard();
    }
  }
  async function init() {
    try {
      state.projects = await Api.proyectos.listar();
      state.holidays = await Api.feriados.listar();
      render();
    } catch (err) {
      console.error("[TaskLogic] Error en init():", err);
      app.innerHTML = `<div style="padding:40px;color:red;font-family:monospace"><strong>Error al iniciar la aplicación:</strong><br><pre>${err?.message || err}</pre></div>`;
    }
  }

  function goDashboard() {
    state.currentView = "dashboard";
    state.selectedProjectId = null;
    renderDashboard();
  }

  function goPlanner(projectId) {
    state.currentView = "planner";
    state.selectedProjectId = projectId;
    persistAndRender();
  }

  function nextProjectCode() {
    const max = state.projects.reduce((highest, project) => {
      const number = Number(String(project.codigo || "").replace(/\D/g, ""));
      return Number.isFinite(number) ? Math.max(highest, number) : highest;
    }, 0);

    return `PRY-${String(max + 1).padStart(3, "0")}`;
  }

  function calculateAllProjects() {
    return state.projects.map((project) =>
      Planificador.calculateProject(project, state.holidays, state.controlDate),
    );
  }

  function renderDashboard() {
    const calculated = calculateAllProjects();
    const metrics = {
      projects: calculated.length,
      activities: calculated.reduce(
        (sum, project) => sum + project.metrics.total,
        0,
      ),
      inProcess: calculated.filter((project) => project.estado === "EN_PROCESO")
        .length,
      alerts: calculated.reduce(
        (sum, project) =>
          sum + project.metrics.overdue + project.metrics.observed,
        0,
      ),
    };

    app.innerHTML = `
      <div class="container stack">
        <section class="page-header">
          <div class="page-header__grid">
            <div class="page-header__content">
              <div class="kicker">${App.icon("barChart", 15)} Dashboard de planificación</div>
              <h1 class="page-title">Proyectos</h1>
              <p class="page-subtitle">
                Esta pantalla principal permite crear, editar y consultar proyectos. Cada proyecto conserva su propio planificador,
                mientras los feriados se administran como calendario global.
              </p>
            </div>

            <div class="page-actions">
              <button class="btn" data-action="export-db">${App.icon("download", 17)} Exportar BD</button>
              <button class="btn" data-action="import-holidays">${App.icon("calendar", 17)} Importar feriados</button>
              <button class="btn" data-action="manage-holidays">${App.icon("calendarOff", 17)} Feriados globales</button>
              <button class="btn btn--primary" data-action="new-project">${App.icon("plus", 17)} Nuevo proyecto</button>
            </div>
          </div>
        </section>

        <section class="metrics">
          ${App.metricCard("folder", "Proyectos", metrics.projects, "Planificadores creados")}
          ${App.metricCard("list", "Actividades", metrics.activities, "Total acumulado")}
          ${App.metricCard("clock", "En proceso", metrics.inProcess, "Proyectos activos")}
          ${App.metricCard("alert", "Alertas", metrics.alerts, "Vencidas u observadas")}
        </section>

        <section class="dashboard-layout">
          <div class="panel">
            <div class="panel__head">
              <div class="panel__head__info">
                <h2 class="panel__title">Listado de proyectos</h2>
                <p class="panel__subtitle">Desde aquí se edita el encabezado del proyecto o se ingresa a su Gantt.</p>
              </div>
              <div class="project-search">
                ${App.icon("search", 17)}
                <input id="projectSearch" class="input" type="search" value="${App.escapeHtml(uiState.query)}" placeholder="Buscar por código, título, responsable o área..." />
              </div>
            </div>

            <div id="projectContent"></div>
          </div>

          <aside class="side-stack">
            ${holidaysCardHtml()}
          </aside>
        </section>
      </div>

      ${projectModalHtml()}
      ${holidaysModalHtml()}
      ${importHolidaysModalHtml()}
      ${dbExportModalHtml()}
    `;

    bindDashboardEvents();
    renderProjectContent();
  }

  function projectCardHtml(project) {
    const derivedStatus = project.metrics.overdue ? "VENCIDO" : project.estado;
    const alerts = project.metrics.overdue + project.metrics.observed;

    return `
      <article class="card project-card">
        <div class="project-card__top">
          <div class="project-card__main">
            <div class="project-card__icon">${App.icon("folder", 23)}</div>
            <div>
              <div class="project-card__badges">
                <span class="project-card__code">${App.escapeHtml(project.codigo)}</span>
                ${App.statusPill(derivedStatus)}
              </div>
              <h3 class="project-card__title">${App.escapeHtml(project.titulo)}</h3>
              <p class="project-card__description">${App.escapeHtml(project.descripcion || "Sin descripción registrada.")}</p>
            </div>
          </div>
        </div>

        <div class="project-card__mini">
          <div>
            <div class="project-card__mini-label">Avance</div>
            <div class="project-card__mini-value">${project.metrics.progress}%</div>
          </div>
          <div>
            <div class="project-card__mini-label">Actividades</div>
            <div class="project-card__mini-value">${project.metrics.total}</div>
          </div>
          <div>
            <div class="project-card__mini-label">Alertas</div>
            <div class="project-card__mini-value">${alerts}</div>
          </div>
        </div>

        <div class="progress">
          <div class="progress__bar" style="width:${project.metrics.progress}%"></div>
        </div>

        <div class="project-card__foot">
          <div class="project-card__meta">
            <b>${App.escapeHtml(project.responsable || "Sin responsable")}</b> ·
            ${App.formatDate(project.metrics.globalStart)} → ${App.formatDate(project.metrics.globalEnd)}
          </div>
          <div class="project-card__actions">
            <button class="btn" data-action="edit-project" data-id="${project.id}">${App.icon("edit", 16)} Editar</button>
            <button class="btn" data-action="duplicate-project" data-id="${project.id}">${App.icon("copy", 16)} Duplicar</button>
            <button class="btn btn--danger" data-action="delete-project" data-id="${project.id}">${App.icon("trash", 16)} Eliminar</button>
            <button class="btn btn--primary" data-action="view-planner" data-id="${project.id}">${App.icon("eye", 16)} Ver planificador</button>
          </div>
        </div>
      </article>
    `;
  }

  function emptyProjectsHtml() {
    return `
      <div class="empty-state" style="grid-column:1/-1">
        <div>
          <strong>No se encontraron proyectos.</strong><br>
          Prueba limpiando la búsqueda o registra un nuevo proyecto.
        </div>
      </div>
    `;
  }

  function holidaysCardHtml() {
    const currentYear = new Date().getFullYear();
    const yearHolidays = state.holidays.filter(
      (h) => h.fecha && h.fecha.startsWith(`${currentYear}-`)
    );

    return `
      <div class="card side-card">
        <div class="side-card__head">
          <div>
            <h2>Feriados ${currentYear}</h2>
            <p>No pertenecen a un proyecto. Se comparten con todos los planificadores.</p>
          </div>
          <button class="icon-btn" data-action="manage-holidays">${App.icon("plus", 17)}</button>
        </div>

        <div class="holiday-list">
          ${yearHolidays.length
        ? yearHolidays.map((holiday) => `
              <div class="holiday-item">
                <div>
                  <strong>${App.escapeHtml(holiday.nombre)}</strong>
                  <span>${App.formatDate(holiday.fecha)}</span>
                </div>
                <button class="icon-btn icon-btn--danger" data-action="delete-holiday" data-id="${holiday.id}" title="Eliminar feriado">${App.icon("trash", 15)}</button>
              </div>
            `).join("")
        : `<p class="empty-year-holidays">Sin feriados registrados para ${currentYear}. Usa "Importar feriados" para cargarlos.</p>`
      }
        </div>
      </div>
    `;
  }

  function fieldsInfoCardHtml() {
    return `
      <div class="card side-card">
        <h2>Campos mínimos del proyecto</h2>
        <div class="info-list">
          <div class="info-item"><strong>codigo</strong><span>Identificador único generado como PRY-001.</span></div>
          <div class="info-item"><strong>titulo</strong><span>Nombre editable del proyecto.</span></div>
          <div class="info-item"><strong>cliente / área</strong><span>Área solicitante o usuaria.</span></div>
          <div class="info-item"><strong>responsable</strong><span>Dueño administrativo del cronograma.</span></div>
          <div class="info-item"><strong>estado</strong><span>Pendiente, en proceso, culminado u observado.</span></div>
        </div>
      </div>
    `;
  }

  function projectModalHtml() {
    return `
      <div id="projectModal" class="modal">
        <div class="modal__box">
          <div class="modal__head">
            <div>
              <div id="projectModalKicker" class="kicker">${App.icon("folder", 15)} Proyecto</div>
              <h2 id="projectModalTitle" class="modal__title">Registrar proyecto</h2>
              <p id="projectModalSubtitle" class="modal__subtitle">
                Crea el encabezado del proyecto. Luego podrás ingresar a su planificador y registrar actividades.
              </p>
            </div>
            <button class="icon-btn" data-action="close-project-modal">${App.icon("x", 20)}</button>
          </div>

          <div class="modal__body">
            <div class="form-grid">
              <div class="field">
                <label>Código del proyecto</label>
                <input id="pCodigo" class="input" type="text" disabled />
              </div>

              <div class="field">
                <label>Fecha de registro</label>
                <input id="pCreado" class="input" type="date" />
              </div>

              <div class="field field--full">
                <label>Título del proyecto</label>
                <input id="pTitulo" class="input" type="text" placeholder="Ej. Contratación de servicio de mantenimiento" />
              </div>

              <div class="field">
                <label>Cliente / Área solicitante</label>
                <input id="pCliente" class="input" type="text" placeholder="Ej. Operaciones Túneles" />
              </div>

              <div class="field">
                <label>Responsable principal</label>
                <input id="pResponsable" class="input" type="text" placeholder="Ej. Logística" />
              </div>

              <div class="field">
                <label>Estado administrativo</label>
                <select id="pEstado" class="select">
                  <option value="PENDIENTE">Pendiente</option>
                  <option value="EN_PROCESO">En proceso</option>
                  <option value="CULMINADO">Culminado</option>
                  <option value="OBSERVADO">Observado</option>
                </select>
              </div>

              <div class="field field--full">
                <label>Descripción / Alcance</label>
                <textarea id="pDescripcion" class="textarea" placeholder="Describe el objetivo, alcance o referencia del proyecto."></textarea>
              </div>
            </div>
          </div>

          <div class="modal__foot">
            <button class="btn" data-action="close-project-modal">${App.icon("x", 17)} Cancelar</button>
            <button class="btn btn--primary" data-action="save-project">${App.icon("save", 17)} Guardar proyecto</button>
          </div>
        </div>
      </div>
    `;
  }

  function holidaysModalHtml() {
    return `
      <div id="holidaysModal" class="modal">
        <div class="modal__box">
          <div class="modal__head">
            <div>
              <div class="kicker">${App.icon("calendarOff", 15)} Calendario global</div>
              <h2 class="modal__title">Registrar feriado global</h2>
              <p class="modal__subtitle">Este modal solo registra feriados. La lista visible queda en el dashboard para evitar duplicidad.</p>
            </div>
            <button class="icon-btn" data-action="close-holidays-modal">${App.icon("x", 20)}</button>
          </div>

          <div class="modal__body">
            <div class="form-grid">
              <div class="field">
                <label>Fecha</label>
                <input id="hFecha" class="input" type="date" />
              </div>
              <div class="field">
                <label>Nombre del feriado</label>
                <input id="hNombre" class="input" type="text" placeholder="Ej. Feriado nacional" />
              </div>
            </div>
          </div>

          <div class="modal__foot">
            <button class="btn" data-action="close-holidays-modal">${App.icon("x", 17)} Cancelar</button>
            <button class="btn btn--primary" data-action="add-holiday">${App.icon("plus", 17)} Registrar feriado</button>
          </div>
        </div>
      </div>
    `;
  }

  function importHolidaysModalHtml() {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear - 3; y <= currentYear + 4; y++) years.push(y);

    return `
      <div id="importHolidaysModal" class="modal">
        <div class="modal__box" style="max-width:520px">
          <div class="modal__head">
            <div>
              <div class="kicker">${App.icon("calendar", 15)} Importar feriados</div>
              <h2 class="modal__title">Importar feriados oficiales del Perú</h2>
              <p class="modal__subtitle">Descarga automáticamente los feriados oficiales del calendario peruano para el año que elijas.</p>
            </div>
            <button class="icon-btn" data-action="close-import-holidays-modal">${App.icon("x", 20)}</button>
          </div>

          <div class="modal__body">
            <div class="notice notice--warning">
              ${App.icon("alert", 16)}
              <div>
                <strong>Aviso importante</strong>
                <p>Esta herramienta importa únicamente los feriados oficiales fijos del Perú (Ley 27399 y similares). Los "puentes" y feriados no laborables declarados por <strong>Decreto Supremo del Ejecutivo</strong>, que cambian cada año, <strong>no aparecerán</strong> en la importación y deben agregarse manualmente desde "Feriados globales".</p>
              </div>
            </div>

            <div class="field" style="margin-top:18px">
              <label>Año a importar</label>
              <select id="importHolidaysYear" class="input">
                ${years.map((y) => `<option value="${y}"${y === currentYear ? " selected" : ""}>${y}</option>`).join("")}
              </select>
            </div>

            <p id="importHolidaysError" style="color:var(--red);font-size:13px;margin-top:10px;display:none">
              ${App.icon("alert", 14)} No se pudo conectar con el servicio. Verifica tu conexión a internet e intenta nuevamente.
            </p>
          </div>

          <div class="modal__foot">
            <button class="btn" data-action="close-import-holidays-modal">${App.icon("x", 17)} Cancelar</button>
            <button id="importHolidaysBtn" class="btn btn--primary" data-action="confirm-import-holidays">${App.icon("download", 17)} Importar feriados</button>
          </div>
        </div>
      </div>
    `;
  }

  function dbExportModalHtml() {
    return `
      <div id="dbExportModal" class="modal">
        <div class="modal__box" style="max-width:480px">
          <div class="modal__head">
            <div>
              <div class="kicker">${App.icon("download", 15)} Base de datos</div>
              <h2 class="modal__title">Exportar base de datos</h2>
              <p class="modal__subtitle">Selecciona el formato y confirma con la contraseña de administrador. El archivo exportado puede usarse para migrar la data a la nube.</p>
            </div>
            <button class="icon-btn" data-action="close-dbexport-modal">${App.icon("x", 20)}</button>
          </div>
          <div class="modal__body">
            <div class="field">
              <label>Formato de exportación</label>
              <select id="dbExportFormat" class="input">
                <option value="">— Selecciona un formato —</option>
                <option value="sqlite">SQLite (.sqlite) — Copia directa de la base de datos</option>
                <option value="sql">SQL (.sql) — Sentencias INSERT para SQLite / PostgreSQL</option>
                <option value="mysql">MySQL (.sql) — Sentencias INSERT para MySQL / MariaDB</option>
              </select>
              <p id="dbExportFormatError" style="color:var(--red);font-size:13px;margin-top:6px;display:none">
                ${App.icon("alert", 14)} Selecciona un formato antes de continuar.
              </p>
            </div>
            <div class="field" style="margin-top:14px">
              <label>Contraseña de administrador</label>
              <input id="dbExportPassword" class="input" type="password" placeholder="••••••••" autocomplete="off" />
              <p id="dbExportError" style="color:var(--red);font-size:13px;margin-top:6px;display:none">
                ${App.icon("alert", 14)} Contraseña incorrecta. Contacta al administrador del sistema.
              </p>
            </div>
          </div>
          <div class="modal__foot">
            <button class="btn" data-action="close-dbexport-modal">${App.icon("x", 17)} Cancelar</button>
            <button class="btn btn--primary" data-action="confirm-dbexport">${App.icon("download", 17)} Exportar</button>
          </div>
        </div>
      </div>
    `;
  }

  function sortProjects(list) {
    const copy = [...list];
    if (uiState.sortBy === "antiguo") return copy.reverse();
    if (uiState.sortBy === "avance") return copy.sort((a, b) => b.metrics.progress - a.metrics.progress);
    return copy;
  }

  function sortChip(key, label) {
    const active = uiState.sortBy === key ? " is-active" : "";
    return `<button class="filter-chip${active}" data-action="sort-projects" data-sort="${key}">${label}</button>`;
  }

  function paginationHtml(page, totalPages) {
    const prev = `<button class="pagination__btn" data-action="go-page" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>&lsaquo;</button>`;
    const next = `<button class="pagination__btn" data-action="go-page" data-page="${page + 1}" ${page >= totalPages ? "disabled" : ""}>&rsaquo;</button>`;

    let pageNums = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pageNums.push(i);
    } else {
      const set = new Set([1, totalPages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= totalPages));
      pageNums = [...set].sort((a, b) => a - b);
    }

    let prevN = 0;
    const btns = pageNums.map((n) => {
      const gap = prevN && n > prevN + 1 ? `<span class="pagination__ellipsis">&hellip;</span>` : "";
      prevN = n;
      const active = n === page ? " is-active" : "";
      return `${gap}<button class="pagination__btn${active}" data-action="go-page" data-page="${n}">${n}</button>`;
    }).join("");

    return `<div class="pagination">${prev}${btns}${next}</div>`;
  }

  function renderProjectContent() {
    const container = document.getElementById("projectContent");
    if (!container) return;

    const calculated = calculateAllProjects();
    const query = uiState.query.toLowerCase();
    const filtered = calculated.filter((p) => {
      const text = `${p.codigo} ${p.titulo} ${p.responsable} ${p.cliente}`.toLowerCase();
      return text.includes(query);
    });

    const sorted = sortProjects(filtered);
    const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
    uiState.page = Math.min(uiState.page, totalPages);
    const start = (uiState.page - 1) * PER_PAGE;
    const paginated = sorted.slice(start, start + PER_PAGE);

    container.innerHTML = `
      <div class="project-filters">
        <div class="filter-chips">
          ${sortChip("reciente", "Más recientes")}
          ${sortChip("antiguo", "Más antiguos")}
          ${sortChip("avance", "Mayor avance")}
        </div>
        <span class="project-count">${sorted.length} proyecto${sorted.length !== 1 ? "s" : ""}</span>
      </div>
      <div class="project-grid">
        ${paginated.length ? paginated.map(projectCardHtml).join("") : emptyProjectsHtml()}
      </div>
      ${totalPages > 1 ? paginationHtml(uiState.page, totalPages) : ""}
    `;

    App.bind(container, "[data-action='edit-project']", "click", (e) => openProjectModal("EDIT", e.currentTarget.dataset.id));
    App.bind(container, "[data-action='delete-project']", "click", (e) => deleteProject(e.currentTarget.dataset.id));
    App.bind(container, "[data-action='view-planner']", "click", (e) => goPlanner(e.currentTarget.dataset.id));
    App.bind(container, "[data-action='duplicate-project']", "click", (e) => duplicateProject(e.currentTarget.dataset.id));
    App.bind(container, "[data-action='sort-projects']", "click", (e) => {
      uiState.sortBy = e.currentTarget.dataset.sort;
      uiState.page = 1;
      renderProjectContent();
    });
    App.bind(container, "[data-action='go-page']", "click", (e) => {
      uiState.page = Number(e.currentTarget.dataset.page);
      renderProjectContent();
    });
    App.renderIcons();
  }

  async function duplicateProject(projectId) {
    const source = state.projects.find((p) => String(p.id) === String(projectId));
    if (!source) return;

    const saved = await Api.proyectos.guardar({
      titulo: `${source.titulo} (Copia)`,
      cliente: source.cliente,
      responsable: source.responsable,
      estado: "PENDIENTE",
      descripcion: source.descripcion,
      creado: App.DEFAULT_CONTROL_DATE,
    });

    if (saved?.id && source.actividades?.length) {
      for (const act of source.actividades) {
        const { id: _id, ...rest } = act;
        await Api.actividades.guardar({ ...rest, proyectoId: saved.id });
      }
    }

    state.projects = await Api.proyectos.listar();
    uiState.page = 1;
    render();
    App.showToast("Proyecto duplicado", `Copia de "${source.titulo}" creada exitosamente.`, "success");
  }

  function openImportHolidaysModal() {
    const modal = document.getElementById("importHolidaysModal");
    if (!modal) return;
    document.getElementById("importHolidaysError").style.display = "none";
    const btn = document.getElementById("importHolidaysBtn");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `${App.icon("download", 17)} Importar feriados`;
      App.renderIcons();
    }
    modal.classList.add("is-open");
  }

  function closeImportHolidaysModal() {
    const modal = document.getElementById("importHolidaysModal");
    if (modal) modal.classList.remove("is-open");
  }

  async function confirmImportHolidays() {
    const año = Number(document.getElementById("importHolidaysYear").value);
    const errorEl = document.getElementById("importHolidaysError");
    const btn = document.getElementById("importHolidaysBtn");

    errorEl.style.display = "none";
    btn.disabled = true;
    btn.innerHTML = `${App.icon("clock", 17)} Importando...`;
    App.renderIcons();

    const result = await Api.feriados.importarDeApi(año);

    btn.disabled = false;
    btn.innerHTML = `${App.icon("download", 17)} Importar feriados`;
    App.renderIcons();

    if (!result?.success) {
      errorEl.style.display = "block";
      return;
    }

    closeImportHolidaysModal();
    state.holidays = await Api.feriados.listar();
    render();

    if (result.importados === 0) {
      App.showToast("Sin cambios", `Los feriados de ${año} ya estaban todos registrados.`, "warning");
    } else {
      const extra = result.omitidos > 0 ? `, ${result.omitidos} ya existían.` : ".";
      App.showToast("Feriados importados", `${result.importados} feriados de ${año} agregados${extra}`, "success");
    }
  }

  function openDbExportModal() {
    document.getElementById("dbExportFormat").value = "";
    document.getElementById("dbExportPassword").value = "";
    document.getElementById("dbExportFormatError").style.display = "none";
    document.getElementById("dbExportError").style.display = "none";
    document.getElementById("dbExportModal").classList.add("is-open");
    document.getElementById("dbExportFormat").focus();
  }

  function closeDbExportModal() {
    document.getElementById("dbExportModal").classList.remove("is-open");
  }

  async function confirmDbExport() {
    const format = document.getElementById("dbExportFormat").value;
    const password = document.getElementById("dbExportPassword").value;

    const formatErr = document.getElementById("dbExportFormatError");
    const pwdErr = document.getElementById("dbExportError");

    let valid = true;
    if (!format) { formatErr.style.display = "block"; valid = false; } else { formatErr.style.display = "none"; }
    if (!password) return;
    if (!valid) return;

    pwdErr.style.display = "none";
    const result = await Api.db.exportar(password, format);
    if (result?.success) {
      closeDbExportModal();
      App.showToast("BD exportada", "El archivo se guardó exitosamente.", "success");
    } else {
      pwdErr.style.display = "block";
    }
  }

  function bindDashboardEvents() {
    App.bind(app, "[data-action='new-project']", "click", () => openProjectModal("CREATE"));
    App.bind(app, "[data-action='close-project-modal']", "click", closeProjectModal);
    App.bind(app, "[data-action='save-project']", "click", saveProject);
    App.bind(app, "[data-action='manage-holidays']", "click", openHolidaysModal);
    App.bind(app, "[data-action='close-holidays-modal']", "click", closeHolidaysModal);
    App.bind(app, "[data-action='add-holiday']", "click", addHoliday);
    App.bind(app, "[data-action='delete-holiday']", "click", (e) => deleteHoliday(e.currentTarget.dataset.id));
    App.bind(app, "[data-action='import-holidays']", "click", openImportHolidaysModal);
    App.bind(app, "[data-action='close-import-holidays-modal']", "click", closeImportHolidaysModal);
    App.bind(app, "[data-action='confirm-import-holidays']", "click", confirmImportHolidays);
    App.bind(app, "[data-action='export-db']", "click", openDbExportModal);
    App.bind(app, "[data-action='close-dbexport-modal']", "click", closeDbExportModal);
    App.bind(app, "[data-action='confirm-dbexport']", "click", confirmDbExport);
    const pwdInput = document.getElementById("dbExportPassword");
    if (pwdInput) pwdInput.addEventListener("keydown", (e) => { if (e.key === "Enter") confirmDbExport(); });
    const search = document.getElementById("projectSearch");
    if (search) {
      search.addEventListener("input", (e) => {
        uiState.query = e.target.value;
        uiState.page = 1;
        renderProjectContent();
      });
    }
  }

  function openProjectModal(mode, projectId = null) {
    projectModalMode = mode;

    if (mode === "EDIT") {
      const project = state.projects.find(
        (p) => String(p.id) === String(projectId),
      );
      if (!project) return;

      projectForm = App.clone(project);
    } else {
      projectForm = {
        id: Date.now(),
        codigo: nextProjectCode(),
        titulo: "",
        cliente: "",
        responsable: "",
        estado: "PENDIENTE",
        descripcion: "",
        creado: App.DEFAULT_CONTROL_DATE,
        actividades: [],
      };
    }

    const modal = document.getElementById("projectModal");
    if (!modal) {
      renderDashboard();
      return openProjectModal(mode, projectId);
    }

    fillProjectForm();

    document.getElementById("projectModalKicker").innerHTML =
      `${App.icon("folder", 15)} ${mode === "CREATE" ? "Nuevo proyecto" : projectForm.codigo}`;
    document.getElementById("projectModalTitle").textContent =
      mode === "CREATE" ? "Registrar nuevo proyecto" : "Editar proyecto";
    document.getElementById("projectModalSubtitle").textContent =
      mode === "CREATE"
        ? "Crea el encabezado del proyecto. Luego podrás ingresar a su planificador y registrar actividades."
        : "Actualiza la información principal del proyecto sin afectar sus actividades.";

    modal.classList.add("is-open");
    App.renderIcons();
  }

  function fillProjectForm() {
    document.getElementById("pCodigo").value = projectForm.codigo || "";
    document.getElementById("pCreado").value =
      projectForm.creado || App.DEFAULT_CONTROL_DATE;
    document.getElementById("pTitulo").value = projectForm.titulo || "";
    document.getElementById("pCliente").value = projectForm.cliente || "";
    document.getElementById("pResponsable").value =
      projectForm.responsable || "";
    document.getElementById("pEstado").value =
      projectForm.estado || "PENDIENTE";
    document.getElementById("pDescripcion").value =
      projectForm.descripcion || "";
  }

  function readProjectForm() {
    return {
      ...projectForm,
      codigo: document.getElementById("pCodigo").value,
      creado:
        document.getElementById("pCreado").value || App.DEFAULT_CONTROL_DATE,
      titulo:
        document.getElementById("pTitulo").value.trim() ||
        "Proyecto sin título",
      cliente: document.getElementById("pCliente").value.trim() || "Sin área",
      responsable:
        document.getElementById("pResponsable").value.trim() ||
        "Sin responsable",
      estado: document.getElementById("pEstado").value,
      descripcion: document.getElementById("pDescripcion").value.trim(),
      actividades: projectForm.actividades || [],
    };
  }

  async function saveProject() {
    const cleaned = readProjectForm();

    if (projectModalMode === "CREATE") {
      await Api.proyectos.guardar(cleaned);
      App.showToast("Proyecto creado", "Ya puedes abrir su planificador.", "success");
    } else {
      await Api.proyectos.actualizar(cleaned.id, cleaned);
      App.showToast("Proyecto actualizado", "Los datos principales fueron guardados.", "success");
    }

    closeProjectModal();

    state.projects = await Api.proyectos.listar();
    render();
  }

  async function deleteProject(projectId) {
    const project = state.projects.find((p) => String(p.id) === String(projectId));
    const ok = await App.showConfirm(
      "¿Eliminar proyecto?",
      `"${project?.titulo || "Este proyecto"}" y todas sus actividades serán eliminados. Esta acción no se puede deshacer.`,
    );
    if (!ok) return;

    await Api.proyectos.eliminar(projectId);
    state.projects = await Api.proyectos.listar();
    render();
    App.showToast("Proyecto eliminado", "El proyecto fue retirado del listado.", "success");
  }

  function closeProjectModal() {
    const modal = document.getElementById("projectModal");
    if (modal) modal.classList.remove("is-open");
    projectForm = null;
  }

  function openHolidaysModal() {
    const modal = document.getElementById("holidaysModal");
    if (modal) modal.classList.add("is-open");
  }

  function closeHolidaysModal() {
    const modal = document.getElementById("holidaysModal");
    if (modal) modal.classList.remove("is-open");
  }

  async function addHoliday() {
    const fecha = document.getElementById("hFecha").value;
    const nombre = document.getElementById("hNombre").value.trim();

    if (!fecha || !nombre) {
      App.showToast("Faltan datos", "Ingresa fecha y nombre del feriado.", "warning");
      return;
    }

    await Api.feriados.guardar({ fecha, nombre });

    state.holidays = await Api.feriados.listar();
    render();

    App.showToast("Feriado agregado", "El calendario global fue actualizado.", "success");
  }

  async function deleteHoliday(id) {
    const holiday = state.holidays.find((h) => String(h.id) === String(id));
    const ok = await App.showConfirm(
      "¿Eliminar feriado?",
      `"${holiday?.nombre || "Este feriado"}" (${App.formatDate(holiday?.fecha)}) será eliminado del calendario global.`,
    );
    if (!ok) return;

    await Api.feriados.eliminar(id);
    state.holidays = state.holidays.filter((h) => String(h.id) !== String(id));
    persistAndRender();
    App.showToast("Feriado eliminado", "El calendario global fue actualizado.", "success");
  }

  function resetDemo() {
    const fresh = App.resetState(fallbackState);
    state.controlDate = fresh.controlDate;
    state.holidays = fresh.holidays;
    state.projects = fresh.projects;
    state.currentView = "dashboard";
    state.selectedProjectId = null;
    persistAndRender();
    App.showToast("Demo reiniciada", "Los datos iniciales fueron restaurados.", "success");
  }

  // document.addEventListener("DOMContentLoaded", render);
  document.addEventListener("DOMContentLoaded", init);

  return {
    state,
    render,
    init,
    persistAndRender,
    goDashboard,
    goPlanner,
    openProjectModal,
  };
})();
