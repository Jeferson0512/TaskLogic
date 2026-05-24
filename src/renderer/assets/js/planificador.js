/**
 * planificador.js
 * Lógica de cálculo del Gantt y render del detalle de proyecto.
 */
window.Planificador = (() => {
  const App = window.App;

  function isHoliday(date, holidays) {
    return holidays.some((holiday) => holiday.fecha === App.toISO(date));
  }

  function isCountableDay(date, activity, holidays) {
    if (activity.tipoDia === "HABIL" && App.isWeekend(date)) return false;
    if (activity.considerarFeriados && isHoliday(date, holidays)) return false;
    return true;
  }

  function getNextValidStart(baseISO, activity, holidays) {
    const base = App.parseDate(baseISO);
    if (!base) return "";
    let next = App.addDays(base, 1);
    while (!isCountableDay(next, activity, holidays)) {
      next = App.addDays(next, 1);
    }
    return App.toISO(next);
  }

  function calculateEndDate(activity, holidays) {
    const start = App.parseDate(activity.inicio);
    if (!start) return "";

    if (activity.modo === "FIN_MANUAL") {
      return activity.finManual || activity.inicio;
    }

    const duration = Math.max(1, Number(activity.duracion || 1));
    let current = new Date(start);
    let counted = 0;

    if (!activity.cuentaInicio) current = App.addDays(current, 1);

    while (counted < duration) {
      if (isCountableDay(current, activity, holidays)) counted += 1;
      if (counted < duration) current = App.addDays(current, 1);
    }

    return App.toISO(current);
  }

  function countCountableDaysBetween(startISO, endISO, activity, holidays) {
    const start = App.parseDate(startISO);
    const end = App.parseDate(endISO);
    if (!start || !end || end < start) return 0;

    let current = new Date(start);
    let count = 0;

    while (current <= end) {
      if (isCountableDay(current, activity, holidays)) count += 1;
      current = App.addDays(current, 1);
    }

    return count;
  }

  function countCalendarDaysBetween(startISO, endISO) {
    const start = App.parseDate(startISO);
    const end = App.parseDate(endISO);
    if (!start || !end || end < start) return 0;
    return App.diffDays(start, end) + 1;
  }

  function calculateAutoProgress(activity, holidays, controlISO) {
    const start = App.parseDate(activity.inicio);
    const end = App.parseDate(activity.finCalculado || calculateEndDate(activity, holidays));
    const control = App.parseDate(controlISO);

    if (!start || !end || !control) return 0;
    if (activity.estado === "CULMINADO") return 100;
    if (control < start) return 0;
    if (control >= end) return 100;

    let total = 1;
    let elapsed = 0;

    if (activity.modo === "DURACION") {
      total = Math.max(1, Number(activity.duracion || 1));
      elapsed = countCountableDaysBetween(activity.inicio, App.toISO(control), activity, holidays);
    } else {
      total = Math.max(1, countCalendarDaysBetween(activity.inicio, App.toISO(end)));
      elapsed = countCalendarDaysBetween(activity.inicio, App.toISO(control));
    }

    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  }

  function getAutoStatus(activity, controlISO) {
    if (activity.estado === "OBSERVADO") return "OBSERVADO";
    if (activity.estado === "CULMINADO") return "CULMINADO";

    const start = App.parseDate(activity.inicio);
    const end = App.parseDate(activity.finCalculado);
    const control = App.parseDate(controlISO);

    if (!start || !end || !control) return activity.estado || "PENDIENTE";
    if (control < start) return "PENDIENTE";
    if (control > end) return "VENCIDO";
    return "EN_PROCESO";
  }

  function normalizeActivities(list) {
    return [...(list || [])]
      .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))
      .map((activity, index) => ({ ...activity, orden: index + 1 }));
  }

  function recalculateCascade(list, holidays, fromId = null) {
    const sorted = normalizeActivities(list);
    const startIndex = fromId
      ? sorted.findIndex((activity) => String(activity.id) === String(fromId))
      : 0;

    if (startIndex < 0) return sorted;

    const next = sorted.map((activity) => ({ ...activity }));

    for (let i = startIndex + 1; i < next.length; i += 1) {
      const previous = next[i - 1];
      const current = next[i];
      const previousEnd = calculateEndDate(previous, holidays);
      const newStart = getNextValidStart(previousEnd, current, holidays);
      current.inicio = newStart;

      if (current.modo === "FIN_MANUAL") {
        const end = App.parseDate(current.finManual);
        const start = App.parseDate(newStart);
        if (!end || (start && end < start)) current.finManual = newStart;
      }
    }

    return next;
  }

  function calculateProject(project, holidays, controlISO) {
    const actividades = normalizeActivities(project.actividades).map((activity) => {
      const finCalculado = calculateEndDate(activity, holidays);
      const withEnd = { ...activity, finCalculado };
      return {
        ...withEnd,
        avanceAuto: calculateAutoProgress(withEnd, holidays, controlISO),
        estadoAuto: getAutoStatus(withEnd, controlISO),
      };
    });

    const starts = actividades.map((a) => App.parseDate(a.inicio)).filter(Boolean);
    const ends = actividades.map((a) => App.parseDate(a.finCalculado)).filter(Boolean);

    const globalStart = starts.length ? new Date(Math.min(...starts)) : null;
    const globalEnd = ends.length ? new Date(Math.max(...ends)) : null;
    const totalCalendar = globalStart && globalEnd ? App.diffDays(globalStart, globalEnd) + 1 : 0;
    const progress = actividades.length
      ? Math.round(actividades.reduce((sum, a) => sum + Number(a.avanceAuto || 0), 0) / actividades.length)
      : 0;

    return {
      ...project,
      actividades,
      metrics: {
        total: actividades.length,
        globalStart,
        globalEnd,
        totalCalendar,
        progress,
        completed: actividades.filter((a) => a.estadoAuto === "CULMINADO").length,
        inProgress: actividades.filter((a) => a.estadoAuto === "EN_PROCESO").length,
        pending: actividades.filter((a) => a.estadoAuto === "PENDIENTE").length,
        overdue: actividades.filter((a) => a.estadoAuto === "VENCIDO").length,
        observed: actividades.filter((a) => a.estadoAuto === "OBSERVADO").length,
      },
    };
  }

  function getTimeline(calculatedProject) {
    const starts = calculatedProject.actividades.map((a) => App.parseDate(a.inicio)).filter(Boolean);
    const ends = calculatedProject.actividades.map((a) => App.parseDate(a.finCalculado)).filter(Boolean);

    const min = starts.length ? new Date(Math.min(...starts)) : App.parseDate(App.DEFAULT_CONTROL_DATE);
    const max = ends.length ? new Date(Math.max(...ends)) : App.addDays(min, 15);
    const days = [];
    let current = new Date(min);

    while (current <= max) {
      days.push(new Date(current));
      current = App.addDays(current, 1);
    }

    return { min, max, days };
  }

  function emptyActivity(project) {
    const ordered = normalizeActivities(project.actividades);
    const last = ordered[ordered.length - 1];
    const lastEnd = last ? calculateEndDate(last, window.DashboardProyectos.state.holidays) : App.DEFAULT_CONTROL_DATE;

    const activity = {
      id: Date.now(),
      orden: ordered.length + 1,
      nombre: "Nueva actividad",
      inicio: lastEnd || App.DEFAULT_CONTROL_DATE,
      finManual: "",
      duracion: 1,
      tipoDia: "HABIL",
      modo: "DURACION",
      cuentaInicio: true,
      considerarFeriados: true,
      responsable: project.responsable || "Responsable",
      estado: "PENDIENTE",
    };

    return {
      ...activity,
      inicio: lastEnd ? getNextValidStart(lastEnd, activity, window.DashboardProyectos.state.holidays) : App.DEFAULT_CONTROL_DATE,
    };
  }

  function renderPlanner(app, projectId) {
    const state = window.DashboardProyectos.state;
    const project = state.projects.find((p) => String(p.id) === String(projectId));

    if (!project) {
      window.DashboardProyectos.goDashboard();
      return;
    }

    const calculated = calculateProject(project, state.holidays, state.controlDate);
    const timeline = getTimeline(calculated);

    app.innerHTML = `
      <div class="container stack">
        <section class="page-header">
          <div class="page-header__grid">
            <div class="page-header__content">
              <button class="btn" data-action="go-dashboard">${App.icon("arrowLeft", 17)} Volver a proyectos</button>
              <div style="height:14px"></div>
              <div class="kicker">${App.icon("folder", 15)} ${App.escapeHtml(calculated.codigo)}</div>
              <h1 class="page-title">${App.escapeHtml(calculated.titulo)}</h1>
              <p class="page-subtitle">${App.escapeHtml(calculated.descripcion || "Proyecto sin descripción registrada.")}</p>
              <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
                ${App.statusPill(calculated.estado)}
                <span class="pill">${App.escapeHtml(calculated.cliente || "Sin área")}</span>
                <span class="pill">${App.icon("calendar", 14)} Control: ${App.formatDate(state.controlDate)}</span>
              </div>
            </div>

            <div class="page-actions">
              <div class="export-dropdown">
                <button class="btn" type="button" data-action="toggle-export-menu">${App.icon("download", 17)} Exportar</button>
                <div class="export-dropdown__menu" id="exportMenu">
                  <button type="button" data-action="export-excel">${App.icon("download", 16)} Exportar CSV / Excel</button>
                  <button type="button" data-action="export-image">${App.icon("image", 16)} Exportar SVG</button>
                </div>
              </div>
              <button class="btn btn--primary" data-action="new-activity">${App.icon("plus", 17)} Nueva actividad</button>
            </div>
          </div>
        </section>

        <section class="metrics">
          ${App.metricCard("clock", "Inicio general", App.formatDate(calculated.metrics.globalStart), "Primera actividad")}
          ${App.metricCard("calendar", "Fin estimado", App.formatDate(calculated.metrics.globalEnd), "Último fin calculado")}
          ${App.metricCard("list", "Duración total", `${calculated.metrics.totalCalendar} días`, `${calculated.metrics.total} actividades`)}
          ${App.metricCard("check", "Avance automático", `${calculated.metrics.progress}%`, `${calculated.metrics.completed} culminadas · ${calculated.metrics.overdue} vencidas`)}
        </section>

        <section class="planner-layout">
          <div class="panel">
            <div class="panel__head">
              <div>
                <h2 class="panel__title">Planificador del proyecto</h2>
                <p class="panel__subtitle">Cada actividad calcula fin, avance y estado. “Recalcular en cadena” toma el fin de cada actividad y mueve la siguiente al próximo día válido.</p>
              </div>
              <button class="btn" data-action="cascade-all">${App.icon("settings", 17)} Recalcular en cadena</button>
            </div>

            <div class="gantt-wrap">
              <div class="gantt">
                ${renderGantt(calculated, timeline, state.holidays)}
              </div>
            </div>
          </div>

          <aside class="side-stack side-stack--planner">
            <div class="card side-card side-card--summary">
              <h2>Resumen del proyecto</h2>
              <div class="info-list">
                <div class="info-item">
                  <strong>Responsable</strong>
                  <span>${App.escapeHtml(calculated.responsable || "Sin responsable")}</span>
                </div>
                <div class="info-item">
                  <strong>Cliente / Área</strong>
                  <span>${App.escapeHtml(calculated.cliente || "Sin área")}</span>
                </div>
                <div class="info-item">
                  <strong>Actividades observadas</strong>
                  <span>${calculated.metrics.observed}</span>
                </div>
              </div>
            </div>

            <div class="card side-card side-card--holidays">
              <div class="side-card__head">
                <div>
                  <h2>Feriados aplicables</h2>
                  <p>Se comparten con todos los proyectos, pero cada actividad decide si los excluye.</p>
                </div>
              </div>
              <div class="holiday-list">
                ${state.holidays.map((h) => `
                  <div class="holiday-item">
                    <div>
                      <strong>${App.escapeHtml(h.nombre)}</strong>
                      <span>${App.formatDate(h.fecha)}</span>
                    </div>
                    ${App.icon("calendar", 17)}
                  </div>
                `).join("")}
              </div>
            </div>
          </aside>
        </section>
      </div>

      ${activityModalHtml()}
    `;

    bindPlannerEvents(app, project);
    App.renderIcons();
  }

  function renderGantt(calculated, timeline, holidays) {
    const dayHeaders = timeline.days.map((day) => {
      const classes = ["gantt-day"];
      if (App.isWeekend(day)) classes.push("is-weekend");
      else if (isHoliday(day, holidays)) classes.push("is-holiday");
      return `<div class="${classes.join(" ")}">${String(day.getDate()).padStart(2, "0")}</div>`;
    }).join("");

    const rows = calculated.actividades.map((activity) => {
      const start = App.parseDate(activity.inicio);
      const end = App.parseDate(activity.finCalculado);
      const offset = start ? App.diffDays(timeline.min, start) * 30 : 0;
      const width = start && end ? Math.max(30, (App.diffDays(start, end) + 1) * 30) : 30;

      const gridCells = timeline.days.map((day) => {
        const classes = ["grid-cell"];
        if (App.isWeekend(day)) classes.push("is-weekend");
        else if (isHoliday(day, holidays)) classes.push("is-holiday");
        return `<div class="${classes.join(" ")}"></div>`;
      }).join("");

      return `
        <div class="gantt-row">
          <div class="activity-info">
            <div class="activity-top">
              <div>
                <div class="activity-name">
                  <span class="activity-order">${activity.orden}</span>
                  <strong>${App.escapeHtml(activity.nombre)}</strong>
                </div>
                <div class="activity-meta">
                  <span>${App.formatDate(activity.inicio)} → ${App.formatDate(activity.finCalculado)}</span>
                  ${App.statusPill(activity.estadoAuto)}
                </div>
                <div class="activity-sub">
                  ${App.escapeHtml(activity.responsable || "Sin responsable")} ·
                  ${activity.modo === "DURACION" ? `${activity.duracion} días ${String(activity.tipoDia).toLowerCase()}` : "Fin manual"} ·
                  ${activity.considerarFeriados ? "excluye feriados" : "incluye feriados"}
                </div>
              </div>
              <div class="activity-actions">
                <button class="icon-btn" data-action="edit-activity" data-id="${activity.id}" title="Editar">${App.icon("edit", 16)}</button>
                <button class="icon-btn" data-action="delete-activity" data-id="${activity.id}" title="Eliminar">${App.icon("trash", 16)}</button>
              </div>
            </div>
          </div>
          <div class="timeline">
            <div class="grid-days">${gridCells}</div>
            <div class="bar-layer">
              <div class="bar" style="margin-left:${offset}px;width:${width}px">
                <div class="bar-fill" style="width:${activity.avanceAuto}%"></div>
                <div class="bar-text">
                  <span>${activity.modo === "DURACION" ? `${activity.duracion} días` : "Manual"}</span>
                  <span>${activity.avanceAuto}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    if (!calculated.actividades.length) {
      return `
        <div class="gantt-head">
          <div class="gantt-title">Actividad</div>
          <div class="gantt-days">${dayHeaders}</div>
        </div>
        <div class="empty-state">
          <div>
            <strong>Este proyecto aún no tiene actividades.</strong><br>
            Usa “Nueva actividad” para empezar su planificador.
          </div>
        </div>
      `;
    }

    return `
      <div class="gantt-head">
        <div class="gantt-title">Actividad</div>
        <div class="gantt-days">${dayHeaders}</div>
      </div>
      ${rows}
    `;
  }

  function activityModalHtml() {
    return `
      <div id="activityModal" class="modal">
        <div class="modal__box">
          <div class="modal__head">
            <div>
              <div id="activityModalKicker" class="kicker">${App.icon("list", 15)} Actividad</div>
              <h2 id="activityModalTitle" class="modal__title">Registrar actividad</h2>
              <p class="modal__subtitle">Configura fechas, duración, tipo de día y estado administrativo.</p>
            </div>
            <button class="icon-btn" data-action="close-activity-modal">${App.icon("x", 20)}</button>
          </div>

          <div class="modal__body">
            <div class="form-grid">
              <div class="field field--full">
                <label>Nombre de la actividad</label>
                <input id="aNombre" class="input" type="text" />
              </div>

              <div class="field">
                <label>Responsable</label>
                <input id="aResponsable" class="input" type="text" />
              </div>

              <div class="field">
                <label>Fecha de inicio</label>
                <input id="aInicio" class="input" type="date" />
              </div>

              <div class="field">
                <label>Modo de cálculo</label>
                <select id="aModo" class="select">
                  <option value="DURACION">Por duración</option>
                  <option value="FIN_MANUAL">Fecha final manual</option>
                </select>
              </div>

              <div class="field">
                <label>Fecha final manual</label>
                <input id="aFinManual" class="input" type="date" />
              </div>

              <div class="field">
                <label>Duración</label>
                <input id="aDuracion" class="input" type="number" min="1" />
              </div>

              <div class="field">
                <label>Tipo de día</label>
                <select id="aTipoDia" class="select">
                  <option value="HABIL">Día hábil</option>
                  <option value="CALENDARIO">Día calendario</option>
                </select>
              </div>

              <div class="field">
                <label>Estado administrativo</label>
                <select id="aEstado" class="select">
                  <option value="PENDIENTE">Pendiente</option>
                  <option value="EN_PROCESO">En proceso</option>
                  <option value="CULMINADO">Culminado</option>
                  <option value="OBSERVADO">Observado</option>
                </select>
              </div>

              <div class="field field--full">
                <div class="options-grid">
                  <div class="toggle-card">
                    <div>
                      <strong>Contar inicio</strong>
                      <small>La fecha inicial consume el día 1</small>
                    </div>
                    <button id="aCuentaInicio" class="switch" type="button"><span></span></button>
                  </div>

                  <div class="toggle-card">
                    <div>
                      <strong>Excluir feriados</strong>
                      <small>Aplica según regla de la actividad</small>
                    </div>
                    <button id="aFeriados" class="switch" type="button"><span></span></button>
                  </div>

                  <div class="toggle-card">
                    <div>
                      <strong>Ajustar siguientes</strong>
                      <small>Reprograma etapas posteriores</small>
                    </div>
                    <button id="aCascade" class="switch is-on" type="button"><span></span></button>
                  </div>
                </div>
              </div>

              <div class="field field--full">
                <div class="preview">
                  <div class="preview__title">Vista previa del cálculo</div>
                  <div class="preview__grid">
                    <div class="preview__item"><span>Inicio</span><strong id="pInicio">-</strong></div>
                    <div class="preview__item"><span>Fin calculado</span><strong id="pFin">-</strong></div>
                    <div class="preview__item"><span>Avance automático</span><strong id="pAvance">0%</strong></div>
                    <div class="preview__item"><span>Regla</span><strong id="pRegla">-</strong></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="modal__foot">
            <button class="btn" data-action="close-activity-modal">${App.icon("x", 17)} Cancelar</button>
            <button class="btn btn--primary" data-action="save-activity">${App.icon("save", 17)} Guardar actividad</button>
          </div>
        </div>
      </div>
    `;
  }

  let activityForm = null;
  let activityMode = "CREATE";
  let cascadeOnSave = true;
  let currentProjectRef = null;

  function bindPlannerEvents(app, project) {
    currentProjectRef = project;

    App.bind(app, "[data-action='go-dashboard']", "click", () => window.DashboardProyectos.goDashboard());
    App.bind(app, "[data-action='new-activity']", "click", () => openActivityModal("CREATE", project));
    App.bind(app, "[data-action='close-activity-modal']", "click", closeActivityModal);
    App.bind(app, "[data-action='save-activity']", "click", saveActivity);
    App.bind(app, "[data-action='edit-activity']", "click", (event) => {
      openActivityModal("EDIT", project, event.currentTarget.dataset.id);
    });
    App.bind(app, "[data-action='delete-activity']", "click", (event) => {
      deleteActivity(project.id, event.currentTarget.dataset.id);
    });
    App.bind(app, "[data-action='cascade-all']", "click", () => {
      project.actividades = recalculateCascade(project.actividades, window.DashboardProyectos.state.holidays, null);
      window.DashboardProyectos.persistAndRender();
      App.showToast("Cronograma recalculado", "Las actividades posteriores fueron reorganizadas.");
    });
    App.bind(app, "[data-action='toggle-export-menu']", "click", () => {
      const menu = document.getElementById("exportMenu");
      if (menu) menu.classList.toggle("is-open");
    });
    App.bind(app, "[data-action='export-excel']", "click", () => exportProjectCsv(project));
    App.bind(app, "[data-action='export-image']", "click", () => exportPlannerSvg());

    ["aNombre", "aResponsable", "aInicio", "aModo", "aFinManual", "aDuracion", "aTipoDia", "aEstado"].forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.addEventListener("input", syncActivityForm);
      if (input) input.addEventListener("change", syncActivityForm);
    });

    const cuentaInicio = document.getElementById("aCuentaInicio");
    const feriados = document.getElementById("aFeriados");
    const cascade = document.getElementById("aCascade");

    if (cuentaInicio) cuentaInicio.addEventListener("click", () => toggleActivityBool("cuentaInicio"));
    if (feriados) feriados.addEventListener("click", () => toggleActivityBool("considerarFeriados"));
    if (cascade) cascade.addEventListener("click", () => {
      cascadeOnSave = !cascadeOnSave;
      cascade.classList.toggle("is-on", cascadeOnSave);
    });
  }

  function openActivityModal(mode, project, activityId = null) {
    activityMode = mode;
    cascadeOnSave = true;

    const calculated = calculateProject(project, window.DashboardProyectos.state.holidays, window.DashboardProyectos.state.controlDate);

    if (mode === "EDIT") {
      const selected = calculated.actividades.find((a) => String(a.id) === String(activityId));
      if (!selected) return;
      const { finCalculado, avanceAuto, estadoAuto, ...editable } = selected;
      activityForm = { ...editable };
    } else {
      activityForm = emptyActivity(project);
    }

    fillActivityForm();

    document.getElementById("activityModalTitle").textContent = mode === "CREATE" ? "Registrar actividad" : "Editar actividad";
    document.getElementById("activityModalKicker").innerHTML = `${App.icon("list", 15)} ${mode === "CREATE" ? "Nueva actividad" : "Modificar actividad"}`;
    document.getElementById("activityModal").classList.add("is-open");
    App.renderIcons();
  }

  function closeActivityModal() {
    const modal = document.getElementById("activityModal");
    if (modal) modal.classList.remove("is-open");
    activityForm = null;
  }

  function fillActivityForm() {
    if (!activityForm) return;

    document.getElementById("aNombre").value = activityForm.nombre || "";
    document.getElementById("aResponsable").value = activityForm.responsable || "";
    document.getElementById("aInicio").value = activityForm.inicio || "";
    document.getElementById("aModo").value = activityForm.modo || "DURACION";
    document.getElementById("aFinManual").value = activityForm.finManual || "";
    document.getElementById("aDuracion").value = activityForm.duracion || 1;
    document.getElementById("aTipoDia").value = activityForm.tipoDia || "HABIL";
    document.getElementById("aEstado").value = activityForm.estado || "PENDIENTE";

    document.getElementById("aCuentaInicio").classList.toggle("is-on", Boolean(activityForm.cuentaInicio));
    document.getElementById("aFeriados").classList.toggle("is-on", Boolean(activityForm.considerarFeriados));
    document.getElementById("aCascade").classList.toggle("is-on", Boolean(cascadeOnSave));

    const isDuration = activityForm.modo === "DURACION";
    document.getElementById("aFinManual").disabled = isDuration;
    document.getElementById("aDuracion").disabled = !isDuration;
    document.getElementById("aTipoDia").disabled = false;
    document.getElementById("aCuentaInicio").disabled = false;
    document.getElementById("aFeriados").disabled = false;

    updatePreview();
  }

  function syncActivityForm() {
    if (!activityForm) return;

    activityForm = {
      ...activityForm,
      nombre: document.getElementById("aNombre").value,
      responsable: document.getElementById("aResponsable").value,
      inicio: document.getElementById("aInicio").value,
      modo: document.getElementById("aModo").value,
      finManual: document.getElementById("aFinManual").value,
      duracion: Number(document.getElementById("aDuracion").value || 1),
      tipoDia: document.getElementById("aTipoDia").value,
      estado: document.getElementById("aEstado").value,
    };

    if (activityForm.modo === "FIN_MANUAL" && !activityForm.finManual) {
      activityForm.finManual = activityForm.inicio;
    }

    fillActivityForm();
  }

  function toggleActivityBool(field) {
    if (!activityForm) return;
    activityForm[field] = !activityForm[field];
    fillActivityForm();
  }

  function updatePreview() {
    if (!activityForm) return;

    const holidays = window.DashboardProyectos.state.holidays;
    const previewEnd = calculateEndDate(activityForm, holidays);
    const preview = { ...activityForm, finCalculado: previewEnd };

    document.getElementById("pInicio").textContent = App.formatDate(activityForm.inicio);
    document.getElementById("pFin").textContent = App.formatDate(previewEnd);
    document.getElementById("pAvance").textContent = `${calculateAutoProgress(preview, holidays, window.DashboardProyectos.state.controlDate)}%`;
    document.getElementById("pRegla").textContent = activityForm.modo === "DURACION"
      ? `${activityForm.duracion} días ${String(activityForm.tipoDia).toLowerCase()}`
      : "Fecha final manual";
  }

  function saveActivity() {
    if (!activityForm || !currentProjectRef) return;

    const cleaned = {
      ...activityForm,
      nombre: String(activityForm.nombre || "").trim() || "Actividad sin nombre",
      responsable: String(activityForm.responsable || "").trim() || "Sin responsable",
      duracion: Math.max(1, Number(activityForm.duracion || 1)),
    };

    if (cleaned.modo === "FIN_MANUAL" && !cleaned.finManual) {
      cleaned.finManual = cleaned.inicio;
    }

    const state = window.DashboardProyectos.state;
    const project = state.projects.find((p) => String(p.id) === String(currentProjectRef.id));
    if (!project) return;

    if (activityMode === "CREATE") {
      project.actividades = normalizeActivities([...(project.actividades || []), cleaned]);
      if (cascadeOnSave) project.actividades = recalculateCascade(project.actividades, state.holidays, cleaned.id);
    } else {
      project.actividades = normalizeActivities(
        project.actividades.map((a) => String(a.id) === String(cleaned.id) ? cleaned : a)
      );
      if (cascadeOnSave) project.actividades = recalculateCascade(project.actividades, state.holidays, cleaned.id);
    }

    closeActivityModal();
    window.DashboardProyectos.persistAndRender();
    App.showToast("Actividad guardada", "El planificador fue actualizado correctamente.");
  }

  function deleteActivity(projectId, activityId) {
    const state = window.DashboardProyectos.state;
    const project = state.projects.find((p) => String(p.id) === String(projectId));
    if (!project) return;

    const activity = (project.actividades || []).find((a) => String(a.id) === String(activityId));
    const name = activity ? activity.nombre : "esta actividad";
    if (!confirm(`¿Deseas eliminar la actividad "${name}"?`)) return;

    project.actividades = normalizeActivities(project.actividades.filter((a) => String(a.id) !== String(activityId)));
    window.DashboardProyectos.persistAndRender();
    App.showToast("Actividad eliminada", "El cronograma fue actualizado.");
  }

  function exportProjectCsv(project) {
    const state = window.DashboardProyectos.state;
    const calculated = calculateProject(project, state.holidays, state.controlDate);
    const rows = [
      ["Orden", "Actividad", "Responsable", "Inicio", "Fin", "Modo", "Duracion", "Tipo dia", "Feriados", "Estado", "Avance"],
      ...calculated.actividades.map((a) => [
        a.orden,
        a.nombre,
        a.responsable,
        a.inicio,
        a.finCalculado,
        a.modo,
        a.duracion,
        a.tipoDia,
        a.considerarFeriados ? "Excluye feriados" : "Incluye feriados",
        a.estadoAuto,
        `${a.avanceAuto}%`,
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(";"))
      .join("\n");

    App.downloadBlob(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), `${project.codigo}_cronograma.csv`);
  }

  function getInlineStylesForSvg() {
    const css = [];
    Array.from(document.styleSheets).forEach((sheet) => {
      try {
        Array.from(sheet.cssRules || []).forEach((rule) => css.push(rule.cssText));
      } catch (error) {
        // Ignora hojas externas bloqueadas por CORS.
      }
    });
    return css.join("\\n");
  }

  function exportPlannerSvg() {
    const node = document.querySelector(".gantt");
    if (!node) return;

    const width = Math.max(node.scrollWidth, 1200);
    const height = Math.max(node.scrollHeight, 500);
    const cloned = node.cloneNode(true);

    cloned.querySelectorAll("script, link").forEach((el) => el.remove());

    const xhtml = new XMLSerializer().serializeToString(cloned);
    const styles = getInlineStylesForSvg();

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml">
      <style>${styles.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</style>
      ${xhtml}
    </div>
  </foreignObject>
</svg>`;

    App.downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), "planificador_gantt.svg");
  }

  return {
    isHoliday,
    isCountableDay,
    getNextValidStart,
    calculateEndDate,
    calculateAutoProgress,
    calculateProject,
    normalizeActivities,
    recalculateCascade,
    renderPlanner,
  };
})();
