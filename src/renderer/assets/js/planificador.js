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
      .sort((a, b) => {
        const da = a.inicio || "";
        const db = b.inicio || "";
        if (da !== db) return da.localeCompare(db);
        return Number(a.orden || 0) - Number(b.orden || 0);
      })
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
      ajustarSiguientes: true,
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

    const { globalStart, globalEnd } = calculated.metrics;
    const relevantHolidays = globalStart && globalEnd
      ? state.holidays.filter((h) => { const d = App.parseDate(h.fecha); return d && d >= globalStart && d <= globalEnd; })
      : state.holidays;

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
              </div>
            </div>

            <div class="page-actions">
              <div class="control-date">
                <label for="controlDateInput">${App.icon("calendar", 13)} Fecha de control</label>
                <input type="date" id="controlDateInput" value="${state.controlDate}" />
              </div>
              <div class="export-dropdown">
                <button class="btn" type="button" data-action="toggle-export-menu">${App.icon("download", 17)} Exportar</button>
                <div class="export-dropdown__menu" id="exportMenu">
                  <button type="button" data-action="export-excel">${App.icon("download", 16)} Exportar CSV / Excel</button>
                  <button type="button" data-action="export-image">${App.icon("image", 16)} Exportar SVG</button>
                  <button type="button" data-action="export-png">${App.icon("image", 16)} Exportar PNG (alta calidad)</button>
                  <button type="button" data-action="export-msproject">${App.icon("calendar", 16)} Exportar MS Project (XML)</button>
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
            <div class=”panel__head”>
              <div class=”panel__head__info” style="margin: 0 0 0 20px;">
                <h2 class=”panel__title”>Planificador del proyecto</h2>
                <p class=”panel__subtitle”>Cada actividad calcula su fecha de fin, avance y estado automáticamente.</p>
              </div>
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
                  <p>Solo se muestran los feriados dentro del rango de fechas del proyecto.</p>
                </div>
              </div>
              <div class="holiday-list">
                ${relevantHolidays.length ? relevantHolidays.map((h) => `
                  <div class="holiday-item">
                    <div>
                      <strong>${App.escapeHtml(h.nombre)}</strong>
                      <span>${App.formatDate(h.fecha)}</span>
                    </div>
                    ${App.icon("calendar", 17)}
                  </div>
                `).join("") : `<p style="color:var(--muted);font-size:13px;padding:8px 0">Sin feriados en este rango.</p>`}
              </div>
            </div>
          </aside>
        </section>
      </div>

      ${activityModalHtml()}
      ${pngExportModalHtml()}
    `;

    bindPlannerEvents(app, project);
    App.renderIcons();
  }

  function renderGantt(calculated, timeline, holidays) {
    const DAY_LETTERS = ["D", "L", "M", "X", "J", "V", "S"];
    const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    const monthGroups = [];
    let lastMonthKey = null;
    timeline.days.forEach((day) => {
      const key = `${day.getFullYear()}-${day.getMonth()}`;
      if (key !== lastMonthKey) {
        monthGroups.push({ year: day.getFullYear(), month: day.getMonth(), count: 1 });
        lastMonthKey = key;
      } else {
        monthGroups[monthGroups.length - 1].count++;
      }
    });

    const monthHeaders = monthGroups.map((g) =>
      `<div class="gantt-month" style="width:${g.count * 30}px">${MONTH_NAMES[g.month]} ${g.year}</div>`
    ).join("");

    const dayHeaders = timeline.days.map((day) => {
      const classes = ["gantt-day"];
      if (App.isWeekend(day)) classes.push("is-weekend");
      else if (isHoliday(day, holidays)) classes.push("is-holiday");
      const letter = DAY_LETTERS[day.getDay()];
      const num = String(day.getDate()).padStart(2, "0");
      return `<div class="${classes.join(" ")}"><span class="gantt-day__letter">${letter}</span><span class="gantt-day__num">${num}</span></div>`;
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
                  ${activity.considerarFeriados ? "incluye feriados" : "excluye feriados"}
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
                  <span>${activity.modo === "DURACION" ? `${activity.duracion} días ${activity.tipoDia === "HABIL" ? "háb." : "cal."}` : `${App.diffDays(App.parseDate(activity.inicio), App.parseDate(activity.finCalculado)) + 1} días · Manual`}</span>
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
          <div class="gantt-days">
            <div class="gantt-months">${monthHeaders}</div>
            <div class="gantt-days-inner">${dayHeaders}</div>
          </div>
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
        <div class="gantt-days">
          <div class="gantt-months">${monthHeaders}</div>
          <div class="gantt-days-inner">${dayHeaders}</div>
        </div>
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
                      <strong>Incluir feriados</strong>
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

  function pngExportModalHtml() {
    return `
      <div id="pngExportModal" class="modal">
        <div class="modal__box" style="width:min(480px,100%)">
          <div class="modal__head">
            <div>
              <div class="kicker">${App.icon("image", 15)} Exportar PNG</div>
              <h2 class="modal__title">¿Cuántas actividades por imagen?</h2>
              <p class="modal__subtitle">El Gantt se dividirá en varias imágenes con distribución equilibrada.</p>
            </div>
            <button class="icon-btn" data-action="close-png-modal">${App.icon("x", 20)}</button>
          </div>
          <div class="modal__body">
            <div id="pngPerPageOptions" style="display:flex;gap:10px;flex-wrap:wrap;padding:8px 0">
              ${[3,4,5,6,8,10].map(n => `
                <label style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px">
                  <input type="radio" name="pngPerPage" value="${n}" ${n===6?"checked":""} style="display:none">
                  <span class="png-per-page-chip" data-value="${n}" style="
                    width:64px;height:64px;border-radius:12px;border:2px solid var(--line);
                    display:flex;flex-direction:column;align-items:center;justify-content:center;
                    font-weight:800;font-size:22px;color:var(--text);background:var(--surface);
                    transition:border-color .15s,background .15s;user-select:none
                  ">${n}</span>
                  <span style="font-size:11px;color:var(--muted)">por imagen</span>
                </label>
              `).join("")}
            </div>
            <p id="pngExportPreview" style="margin-top:14px;font-size:13px;color:var(--muted)"></p>
          </div>
          <div class="modal__foot">
            <button class="btn" data-action="close-png-modal">${App.icon("x", 17)} Cancelar</button>
            <button class="btn btn--primary" data-action="confirm-png-export">${App.icon("download", 17)} Exportar</button>
          </div>
        </div>
      </div>
    `;
  }

  let activityForm = null;
  let activityMode = "CREATE";
  let cascadeOnSave = true;
  let currentProjectRef = null;

  // Resuelve con el nº elegido, o null si cancela. Solo se muestra cuando hay > maxPerPage acts.
  let _pngExportResolve = null;

  function openPngExportModal(totalActs) {
    const modal = document.getElementById("pngExportModal");
    if (!modal) return;

    // Actualiza el preview al valor seleccionado
    function updatePreview(perPage) {
      const pages = Math.ceil(totalActs / perPage);
      const base  = Math.floor(totalActs / pages);
      const extra = totalActs % pages;
      const dist  = Array.from({ length: pages }, (_, i) => i < extra ? base + 1 : base);
      const preview = document.getElementById("pngExportPreview");
      if (preview) {
        preview.textContent = `${totalActs} actividades → ${pages} imagen${pages > 1 ? "es" : ""}: ${dist.join(" + ")}`;
      }
    }

    // Inicializa chips y preview
    const chips = modal.querySelectorAll(".png-per-page-chip");
    chips.forEach(chip => {
      const val = Number(chip.dataset.value);
      const isSelected = val === 6;
      chip.style.borderColor = isSelected ? "var(--primary)" : "var(--line)";
      chip.style.background  = isSelected ? "var(--primary-subtle, #eff6ff)" : "var(--surface)";
      chip.style.color       = isSelected ? "var(--primary)" : "var(--text)";
      chip.onclick = () => {
        chips.forEach(c => {
          c.style.borderColor = "var(--line)";
          c.style.background  = "var(--surface)";
          c.style.color       = "var(--text)";
        });
        chip.style.borderColor = "var(--primary)";
        chip.style.background  = "var(--primary-subtle, #eff6ff)";
        chip.style.color       = "var(--primary)";
        const radio = modal.querySelector(`input[value="${val}"]`);
        if (radio) radio.checked = true;
        updatePreview(val);
      };
    });
    updatePreview(6);
    modal.classList.add("is-open");
  }

  function closePngExportModal(resolve = false) {
    const modal = document.getElementById("pngExportModal");
    if (modal) modal.classList.remove("is-open");
    if (_pngExportResolve) {
      if (resolve) {
        const checked = modal?.querySelector("input[name='pngPerPage']:checked");
        _pngExportResolve(checked ? Number(checked.value) : 6);
      } else {
        _pngExportResolve(null);
      }
      _pngExportResolve = null;
    }
  }

  function bindPlannerEvents(app, project) {
    currentProjectRef = project;

    App.bind(app, "[data-action='go-dashboard']", "click", () => window.DashboardProyectos.goDashboard());
    App.bind(app, "[data-action='new-activity']", "click", () => openActivityModal("CREATE", project));
    App.bind(app, "[data-action='close-activity-modal']", "click", closeActivityModal);
    App.bind(app, "[data-action='close-png-modal']",     "click", () => closePngExportModal(false));
    App.bind(app, "[data-action='confirm-png-export']",  "click", () => closePngExportModal(true));
    App.bind(app, "[data-action='save-activity']", "click", saveActivity);
    App.bind(app, "[data-action='edit-activity']", "click", (event) => {
      openActivityModal("EDIT", project, event.currentTarget.dataset.id);
    });
    App.bind(app, "[data-action='delete-activity']", "click", (event) => {
      deleteActivity(project.id, event.currentTarget.dataset.id);
    });
    App.bind(app, "[data-action='toggle-export-menu']", "click", () => {
      const menu = document.getElementById("exportMenu");
      if (menu) menu.classList.toggle("is-open");
    });
    App.bind(app, "[data-action='export-excel']", "click", () => exportProjectCsv(project));
    App.bind(app, "[data-action='export-image']", "click", () => exportPlannerSvg(project));
    App.bind(app, "[data-action='export-png']", "click", () => exportPlannerPng(project));
    App.bind(app, "[data-action='export-msproject']", "click", () => exportMsProjectXml(project));

    const controlInput = document.getElementById("controlDateInput");
    if (controlInput) {
      controlInput.addEventListener("change", (e) => {
        if (!e.target.value) return;
        window.DashboardProyectos.state.controlDate = e.target.value;
        window.DashboardProyectos.persistAndRender();
      });
    }

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
      if (activityForm) activityForm.ajustarSiguientes = cascadeOnSave;
    });
  }

  function openActivityModal(mode, project, activityId = null) {
    activityMode = mode;
    const calculated = calculateProject(project, window.DashboardProyectos.state.holidays, window.DashboardProyectos.state.controlDate);

    if (mode === "EDIT") {
      const selected = calculated.actividades.find((a) => String(a.id) === String(activityId));
      if (!selected) return;
      const { finCalculado, avanceAuto, estadoAuto, ...editable } = selected;
      activityForm = { ...editable };
    } else {
      activityForm = emptyActivity(project);
    }

    cascadeOnSave = activityForm.ajustarSiguientes !== false;

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

  async function saveActivity() {
    if (!activityForm || !currentProjectRef) return;

    const cleaned = {
      ...activityForm,
      proyectoId: currentProjectRef.id,
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
      const saved = await Api.actividades.guardar(cleaned);
      const savedId = saved?.id || cleaned.id;
      let list = normalizeActivities([...(project.actividades || []), { ...cleaned, id: savedId }]);
      if (cascadeOnSave) {
        list = recalculateCascade(list, state.holidays, savedId);
        for (const act of list) {
          if (String(act.id) !== String(savedId)) {
            await Api.actividades.actualizar(act.id, { ...act, proyectoId: project.id });
          }
        }
      }
      project.actividades = list;
    } else {
      await Api.actividades.actualizar(cleaned.id, cleaned);
      let list = normalizeActivities(
        project.actividades.map((a) => String(a.id) === String(cleaned.id) ? cleaned : a)
      );
      if (cascadeOnSave) {
        list = recalculateCascade(list, state.holidays, cleaned.id);
        for (const act of list) {
          if (String(act.id) !== String(cleaned.id)) {
            await Api.actividades.actualizar(act.id, { ...act, proyectoId: project.id });
          }
        }
      }
      project.actividades = list;
    }

    closeActivityModal();
    window.DashboardProyectos.persistAndRender();
    App.showToast("Actividad guardada", "El planificador fue actualizado correctamente.", "success");
  }

  async function deleteActivity(projectId, activityId) {
    const state = window.DashboardProyectos.state;
    const project = state.projects.find((p) => String(p.id) === String(projectId));
    if (!project) return;

    const activity = (project.actividades || []).find((a) => String(a.id) === String(activityId));
    const name = activity ? activity.nombre : "esta actividad";
    const ok = await App.showConfirm(
      "¿Eliminar actividad?",
      `"${name}" será eliminada del cronograma. Esta acción no se puede deshacer.`,
    );
    if (!ok) return;

    await Api.actividades.eliminar(activityId);
    project.actividades = normalizeActivities(project.actividades.filter((a) => String(a.id) !== String(activityId)));
    window.DashboardProyectos.persistAndRender();
    App.showToast("Actividad eliminada", "El cronograma fue actualizado.", "success");
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
        a.considerarFeriados ? "Incluye feriados" : "Excluye feriados",
        a.estadoAuto,
        `${a.avanceAuto}%`,
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(";"))
      .join("\n");

    App.downloadBlob(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), `${project.codigo}_cronograma.csv`);
  }

  // Divide actividades en páginas con distribución balanceada.
  // Garantiza que ninguna página tenga una cantidad muy desigual vs las demás.
  function splitIntoPages(acts, maxPerPage = 6) {
    if (acts.length <= maxPerPage) return [acts];
    const pages = Math.ceil(acts.length / maxPerPage);
    const base  = Math.floor(acts.length / pages);
    const extra = acts.length % pages;
    const result = [];
    let idx = 0;
    for (let i = 0; i < pages; i++) {
      const count = i < extra ? base + 1 : base;
      result.push(acts.slice(idx, idx + count));
      idx += count;
    }
    return result;
  }

  // Convierte un SVG string a PNG y lo descarga.
  function svgToPng(svgStr, filename) {
    const SCALE = 2;
    const svgBase64 = btoa(unescape(encodeURIComponent(svgStr)));
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width  = img.naturalWidth  * SCALE;
        canvas.height = img.naturalHeight * SCALE;
        const ctx = canvas.getContext("2d");
        ctx.scale(SCALE, SCALE);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, img.naturalWidth, img.naturalHeight);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => { App.downloadBlob(blob, filename); resolve(); }, "image/png");
      };
      img.onerror = () => resolve();
      img.src = `data:image/svg+xml;base64,${svgBase64}`;
    });
  }

  // pageInfo: { page: 1, total: 3 } | null
  function buildGanttSvg(calculated, timeline, holidays, pageInfo = null) {
    const acts = calculated.actividades;
    const days = timeline.days;

    // ── Dimensiones dinámicas ──────────────────────────────────────────────
    const n = acts.length;
    const ROW_H = n <= 8  ? 96
                : n <= 14 ? 80
                : n <= 20 ? 68
                :           58;

    const totalDays = days.length;
    const DAY_W = totalDays <= 35  ? 30
                : totalDays <= 70  ? 20
                : totalDays <= 150 ? 12
                :                    7;

    const LABEL_W   = 390;
    const PROJECT_H = 44;           // cabecera oscura con info del proyecto
    const MONTH_H   = 22;
    const DAY_H     = DAY_W >= 10 ? 38 : 22;
    const HEAD_H    = MONTH_H + DAY_H;
    const FONT      = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

    const svgW = LABEL_W + days.length * DAY_W;
    const svgH = PROJECT_H + HEAD_H + Math.max(1, acts.length) * ROW_H;

    const DAY_LETTERS  = ["D", "L", "M", "X", "J", "V", "S"];
    const MONTH_NAMES  = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

    const p    = [];
    const defs = [];

    // ── Fondo base ─────────────────────────────────────────────────────────
    p.push(`<rect width="${svgW}" height="${svgH}" fill="#ffffff"/>`);

    // ── Cabecera de proyecto ───────────────────────────────────────────────
    const titulo    = App.escapeHtml(calculated.titulo || "");
    const codigo    = App.escapeHtml(calculated.codigo || "");
    const cliente   = App.escapeHtml(calculated.cliente || "");
    const resp      = App.escapeHtml(calculated.responsable || "");
    const maxTitulo = Math.floor((svgW - 48 - (pageInfo ? 110 : (cliente.length * 7 + 16))) / 8);
    const tituloTxt = titulo.length > maxTitulo ? titulo.substring(0, maxTitulo - 1) + "…" : titulo;
    const pageLabel = pageInfo ? `Pág ${pageInfo.page} / ${pageInfo.total}` : "";

    p.push(`<rect width="${svgW}" height="${PROJECT_H}" fill="#0f172a"/>`);
    p.push(`<text x="16" y="16" font-family="${FONT}" font-size="8"  font-weight="700" letter-spacing="0.5" fill="#64748b">${codigo}</text>`);
    p.push(`<text x="16" y="33" font-family="${FONT}" font-size="12" font-weight="900" fill="#f1f5f9">${tituloTxt}</text>`);
    if (pageInfo) {
      p.push(`<text x="${svgW - 12}" y="16" font-family="${FONT}" font-size="8"  fill="#64748b" text-anchor="end">${App.escapeHtml(cliente)}</text>`);
      p.push(`<text x="${svgW - 12}" y="33" font-family="${FONT}" font-size="11" font-weight="800" fill="#38bdf8" text-anchor="end">${pageLabel}</text>`);
    } else {
      p.push(`<text x="${svgW - 12}" y="16" font-family="${FONT}" font-size="8"  fill="#64748b" text-anchor="end">${App.escapeHtml(cliente)}</text>`);
      p.push(`<text x="${svgW - 12}" y="33" font-family="${FONT}" font-size="9"  fill="#94a3b8" text-anchor="end">${resp}</text>`);
    }

    // ── Franjas de fines de semana / feriados (zona de filas) ──────────────
    const rowsTop = PROJECT_H + HEAD_H;
    days.forEach((day, i) => {
      const x = LABEL_W + i * DAY_W;
      const isWknd = day.getDay() === 0 || day.getDay() === 6;
      const isHol  = holidays.some((h) => h.fecha === App.toISO(day));
      if (isWknd) p.push(`<rect x="${x}" y="${PROJECT_H}" width="${DAY_W}" height="${svgH - PROJECT_H}" fill="#f1f5f9"/>`);
      else if (isHol) p.push(`<rect x="${x}" y="${PROJECT_H}" width="${DAY_W}" height="${svgH - PROJECT_H}" fill="#fffbeb"/>`);
    });

    // ── Fondo del header de timescale ──────────────────────────────────────
    p.push(`<rect x="0" y="${PROJECT_H}" width="${svgW}" height="${HEAD_H}" fill="#f8fafc"/>`);

    // ── Tier superior: meses ───────────────────────────────────────────────
    const mgroups = [];
    let lastKey = null;
    days.forEach((day, i) => {
      const key = `${day.getFullYear()}-${day.getMonth()}`;
      if (key !== lastKey) {
        mgroups.push({ month: day.getMonth(), year: day.getFullYear(), start: i, count: 1 });
        lastKey = key;
      } else {
        mgroups[mgroups.length - 1].count++;
      }
    });

    const mTop = PROJECT_H;
    mgroups.forEach((g) => {
      const x = LABEL_W + g.start * DAY_W;
      const w = g.count * DAY_W;
      p.push(`<text x="${x + w / 2}" y="${mTop + MONTH_H / 2 + 5}" font-family="${FONT}" font-size="9" font-weight="900" letter-spacing="0.6" fill="#64748b" text-anchor="middle">${MONTH_NAMES[g.month]} ${g.year}</text>`);
      if (g.start > 0) p.push(`<line x1="${x}" y1="${mTop}" x2="${x}" y2="${mTop + MONTH_H}" stroke="#e2e8f0" stroke-width="1"/>`);
    });
    p.push(`<line x1="${LABEL_W}" y1="${mTop + MONTH_H}" x2="${svgW}" y2="${mTop + MONTH_H}" stroke="#f1f5f9" stroke-width="1"/>`);

    // ── Tier inferior: días o semanas según DAY_W ─────────────────────────
    const dTop = PROJECT_H + MONTH_H;
    if (DAY_W >= 20) {
      days.forEach((day, i) => {
        const x  = LABEL_W + i * DAY_W;
        const isWknd = day.getDay() === 0 || day.getDay() === 6;
        const isHol  = holidays.some((h) => h.fecha === App.toISO(day));
        const tc = isWknd ? "#94a3b8" : isHol ? "#92400e" : "#64748b";
        p.push(`<text x="${x + DAY_W / 2}" y="${dTop + 14}" font-family="${FONT}" font-size="8" font-weight="700" fill="${tc}" text-anchor="middle" opacity="0.7">${DAY_LETTERS[day.getDay()]}</text>`);
        p.push(`<text x="${x + DAY_W / 2}" y="${dTop + 28}" font-family="${FONT}" font-size="10" font-weight="800" fill="${tc}" text-anchor="middle">${String(day.getDate()).padStart(2, "0")}</text>`);
        p.push(`<line x1="${x + DAY_W}" y1="${dTop}" x2="${x + DAY_W}" y2="${dTop + DAY_H}" stroke="#f1f5f9" stroke-width="0.5"/>`);
      });
    } else if (DAY_W >= 10) {
      days.forEach((day, i) => {
        const x  = LABEL_W + i * DAY_W;
        const isWknd = day.getDay() === 0 || day.getDay() === 6;
        const isHol  = holidays.some((h) => h.fecha === App.toISO(day));
        const tc = isWknd ? "#94a3b8" : isHol ? "#92400e" : "#64748b";
        p.push(`<text x="${x + DAY_W / 2}" y="${dTop + 15}" font-family="${FONT}" font-size="8" font-weight="700" fill="${tc}" text-anchor="middle">${String(day.getDate()).padStart(2, "0")}</text>`);
        p.push(`<line x1="${x + DAY_W}" y1="${dTop}" x2="${x + DAY_W}" y2="${dTop + DAY_H}" stroke="#f1f5f9" stroke-width="0.5"/>`);
      });
    } else {
      // DAY_W < 10: marcas cada lunes + fecha DD/MM
      days.forEach((day, i) => {
        if (day.getDay() === 1) {
          const x = LABEL_W + i * DAY_W;
          const label = `${String(day.getDate()).padStart(2, "0")}/${String(day.getMonth() + 1).padStart(2, "0")}`;
          p.push(`<line x1="${x}" y1="${dTop}" x2="${x}" y2="${dTop + DAY_H}" stroke="#e2e8f0" stroke-width="0.8"/>`);
          p.push(`<text x="${x + 2}" y="${dTop + 14}" font-family="${FONT}" font-size="7" fill="#64748b">${label}</text>`);
        }
      });
    }

    // ── Línea separadora de header + etiqueta ACTIVIDAD ───────────────────
    const hdrBottom = PROJECT_H + HEAD_H;
    p.push(`<line x1="0" y1="${hdrBottom}" x2="${svgW}" y2="${hdrBottom}" stroke="#e2e8f0" stroke-width="1"/>`);
    p.push(`<text x="16" y="${PROJECT_H + HEAD_H / 2 + 5}" font-family="${FONT}" font-size="11" font-weight="900" letter-spacing="0.8" fill="#64748b">ACTIVIDAD</text>`);
    p.push(`<line x1="${LABEL_W}" y1="${PROJECT_H}" x2="${LABEL_W}" y2="${svgH}" stroke="#e2e8f0" stroke-width="1"/>`);

    // ── Colores de estado ─────────────────────────────────────────────────
    const STATUS_COLORS = {
      PENDIENTE:  { bg: "#f8fafc", text: "#475569", border: "#e2e8f0", bar: "#334155", barFill: "#64748b" },
      EN_PROCESO: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe", bar: "#1e40af", barFill: "#60a5fa" },
      CULMINADO:  { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0", bar: "#065f46", barFill: "#34d399" },
      OBSERVADO:  { bg: "#fffbeb", text: "#b45309", border: "#fde68a", bar: "#78350f", barFill: "#fbbf24" },
      VENCIDO:    { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca", bar: "#7f1d1d", barFill: "#f87171" },
    };

    const fsName = ROW_H >= 80 ? 13 : ROW_H >= 68 ? 12 : 11;
    const fsMeta = ROW_H >= 80 ? 11 : 10;
    const badgeR = ROW_H >= 80 ? 12 : 10;
    const PILL_W = 80;
    const PILL_H = 18;
    const pillX  = LABEL_W - PILL_W - 12;

    // ── Filas de actividades ──────────────────────────────────────────────
    acts.forEach((act, rowIdx) => {
      const y = hdrBottom + rowIdx * ROW_H;

      p.push(`<line x1="0" y1="${y + ROW_H}" x2="${svgW}" y2="${y + ROW_H}" stroke="#f1f5f9" stroke-width="1"/>`);
      days.forEach((_, i) => {
        const gx = LABEL_W + i * DAY_W;
        p.push(`<line x1="${gx + DAY_W}" y1="${y}" x2="${gx + DAY_W}" y2="${y + ROW_H}" stroke="#f1f5f9" stroke-width="0.5"/>`);
      });

      const rawStatus  = String(act.estadoAuto || act.estado || "PENDIENTE");
      const sc         = STATUS_COLORS[rawStatus] || STATUS_COLORS.PENDIENTE;
      const statusLabel = rawStatus.replace("_", " ");

      const bdgCy = y + ROW_H / 2;
      p.push(`<circle cx="28" cy="${bdgCy}" r="${badgeR}" fill="#f1f5f9"/>`);
      p.push(`<text x="28" y="${bdgCy + 4}" font-family="${FONT}" font-size="11" font-weight="900" fill="#475569" text-anchor="middle">${act.orden}</text>`);

      const pillY = y + Math.round(ROW_H * 0.36);
      p.push(`<rect x="${pillX}" y="${pillY}" width="${PILL_W}" height="${PILL_H}" rx="${PILL_H / 2}" fill="${sc.bg}" stroke="${sc.border}" stroke-width="1"/>`);
      p.push(`<text x="${pillX + PILL_W / 2}" y="${pillY + 12}" font-family="${FONT}" font-size="9" font-weight="900" fill="${sc.text}" text-anchor="middle">${App.escapeHtml(statusLabel)}</text>`);

      const textName  = y + Math.round(ROW_H * 0.29);
      const textDates = y + Math.round(ROW_H * 0.48);
      const textMeta  = y + Math.round(ROW_H * 0.66);

      const maxNameW = LABEL_W - 68 - PILL_W - 18;
      const maxChars = Math.floor(maxNameW / 7);
      const nameText = act.nombre.length > maxChars ? act.nombre.substring(0, maxChars - 1) + "…" : act.nombre;
      p.push(`<text x="52" y="${textName}" font-family="${FONT}" font-size="${fsName}" font-weight="700" fill="#0f172a">${App.escapeHtml(nameText)}</text>`);
      p.push(`<text x="52" y="${textDates}" font-family="${FONT}" font-size="${fsMeta}" fill="#64748b">${App.escapeHtml(`${App.formatDate(act.inicio)} → ${App.formatDate(act.finCalculado)}`)}</text>`);

      const durLabel = act.modo === "DURACION" ? `${act.duracion}d ${String(act.tipoDia).toLowerCase()}` : "fin manual";
      const holLabel = act.considerarFeriados ? "incl. feriados" : "excl. feriados";
      p.push(`<text x="52" y="${textMeta}" font-family="${FONT}" font-size="${fsMeta}" fill="#94a3b8">${App.escapeHtml(`${act.responsable}  ·  ${durLabel}  ·  ${holLabel}`)}</text>`);

      const start = App.parseDate(act.inicio);
      const end   = App.parseDate(act.finCalculado);
      if (start && end) {
        const offset = App.diffDays(timeline.min, start) * DAY_W;
        const barW   = Math.max(DAY_W, (App.diffDays(start, end) + 1) * DAY_W);
        const barX   = LABEL_W + offset;
        const barH   = 28;
        const barY   = y + (ROW_H - barH) / 2;
        const fillW  = Math.max(0, Math.round(barW * act.avanceAuto / 100));
        const r      = barH / 2;
        const clipId = `c${rowIdx}`;
        defs.push(`<clipPath id="${clipId}"><rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="${r}"/></clipPath>`);
        p.push(`<rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="${r}" fill="${sc.bar}"/>`);
        if (fillW > 0) p.push(`<rect x="${barX}" y="${barY}" width="${fillW}" height="${barH}" fill="${sc.barFill}" clip-path="url(#${clipId})"/>`);
        if (barW >= 50) {
          const dayType = act.tipoDia === "HABIL" ? "háb." : "cal.";
          const durStr  = act.modo === "DURACION"
            ? `${act.duracion} días ${dayType}`
            : `${App.diffDays(App.parseDate(act.inicio), App.parseDate(act.finCalculado)) + 1} días · Manual`;
          p.push(`<text x="${barX + 10}" y="${barY + barH / 2 + 4}" font-family="${FONT}" font-size="11" font-weight="700" fill="#fff">${App.escapeHtml(durStr)}</text>`);
          p.push(`<text x="${barX + barW - 10}" y="${barY + barH / 2 + 4}" font-family="${FONT}" font-size="11" font-weight="700" fill="#fff" text-anchor="end">${act.avanceAuto}%</text>`);
        }
      }
    });

    if (!acts.length) {
      p.push(`<text x="${svgW / 2}" y="${hdrBottom + ROW_H / 2 + 6}" font-family="${FONT}" font-size="14" fill="#64748b" text-anchor="middle">Sin actividades registradas</text>`);
    }

    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}">\n<defs>${defs.join("")}</defs>\n${p.join("\n")}\n</svg>`;
  }

  function exportPlannerSvg(project) {
    const state = window.DashboardProyectos.state;
    const calculated = calculateProject(project, state.holidays, state.controlDate);
    const timeline = getTimeline(calculated);
    const svgStr = buildGanttSvg(calculated, timeline, state.holidays);
    App.downloadBlob(new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" }), `${project.codigo}_gantt.svg`);
  }

  async function exportPlannerPng(project) {
    const state      = window.DashboardProyectos.state;
    const calculated = calculateProject(project, state.holidays, state.controlDate);
    const totalActs  = calculated.actividades.length;

    // Si hay más de 6 actividades, pregunta cuántas por imagen; si no, descarga directo.
    let maxPerPage = 6;
    if (totalActs > 6) {
      const chosen = await new Promise((resolve) => {
        _pngExportResolve = resolve;
        openPngExportModal(totalActs);
      });
      if (chosen === null) return; // usuario canceló
      maxPerPage = chosen;
    }

    const pages = splitIntoPages(calculated.actividades, maxPerPage);

    for (let i = 0; i < pages.length; i++) {
      const subset   = { ...calculated, actividades: pages[i] };
      // Cada página tiene su propio timeline: del inicio de su primera actividad
      // hasta el fin de su última. No se estira al rango total del proyecto.
      const timeline = getTimeline(subset);
      const pageInfo = pages.length > 1 ? { page: i + 1, total: pages.length } : null;
      const svgStr   = buildGanttSvg(subset, timeline, state.holidays, pageInfo);
      const suffix   = pages.length > 1 ? `_${i + 1}de${pages.length}` : "";
      await svgToPng(svgStr, `${project.codigo}_gantt${suffix}.png`);
      if (i < pages.length - 1) await new Promise((r) => setTimeout(r, 350));
    }
  }

  function exportMsProjectXml(project) {
    const state      = window.DashboardProyectos.state;
    const calculated = calculateProject(project, state.holidays, state.controlDate);
    const esc        = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    // Cuenta días hábiles (lun-vie) entre dos fechas, sin feriados
    function workDaysBetween(startDate, endDate) {
      if (!startDate || !endDate) return 1;
      let count = 0;
      let cur = new Date(startDate);
      while (cur <= endDate) {
        const d = cur.getDay();
        if (d !== 0 && d !== 6) count++;
        cur = App.addDays(cur, 1);
      }
      return Math.max(1, count);
    }

    const globalStart   = calculated.metrics.globalStart;
    const globalEnd     = calculated.metrics.globalEnd;
    const projStartISO  = globalStart ? `${App.toISO(globalStart)}T08:00:00` : "2026-01-01T08:00:00";
    const projFinishISO = globalEnd   ? `${App.toISO(globalEnd)}T17:00:00`   : "2026-12-31T17:00:00";
    const today         = App.toISO(new Date());

    // ── Tareas ────────────────────────────────────────────────────────────
    const taskNodes = calculated.actividades.map((act, i) => {
      const uid       = i + 1;
      const start     = App.parseDate(act.inicio);
      const end       = App.parseDate(act.finCalculado);
      const startISO  = `${act.inicio}T08:00:00`;
      const finishISO = `${act.finCalculado || act.inicio}T17:00:00`;

      // Días hábiles para Duration (DurationFormat 7 = días de trabajo)
      const wDays    = act.modo === "DURACION" ? Number(act.duracion) : workDaysBetween(start, end);
      const durStr   = `P${wDays}DT0H0M0S`;

      const statusMap = { PENDIENTE: 0, EN_PROCESO: 1, CULMINADO: 2, OBSERVADO: 1, VENCIDO: 1 };
      const taskStatus = statusMap[act.estadoAuto || act.estado] ?? 0;

      return `    <Task>
      <UID>${uid}</UID>
      <ID>${uid}</ID>
      <Name>${esc(act.nombre)}</Name>
      <Type>1</Type>
      <IsNull>0</IsNull>
      <CreateDate>${today}T00:00:00</CreateDate>
      <WBS>${uid}</WBS>
      <OutlineNumber>${uid}</OutlineNumber>
      <OutlineLevel>1</OutlineLevel>
      <Priority>500</Priority>
      <Start>${startISO}</Start>
      <Finish>${finishISO}</Finish>
      <Duration>${durStr}</Duration>
      <DurationFormat>7</DurationFormat>
      <Work>PT${wDays * 8}H0M0S</Work>
      <ResumeValid>0</ResumeValid>
      <EffortDriven>0</EffortDriven>
      <Recurring>0</Recurring>
      <OverAllocated>0</OverAllocated>
      <Estimated>0</Estimated>
      <Milestone>0</Milestone>
      <Summary>0</Summary>
      <Critical>0</Critical>
      <IsSubproject>0</IsSubproject>
      <IsSubprojectReadOnly>0</IsSubprojectReadOnly>
      <ExternalTask>0</ExternalTask>
      <EarlyStart>${startISO}</EarlyStart>
      <EarlyFinish>${finishISO}</EarlyFinish>
      <LateStart>${startISO}</LateStart>
      <LateFinish>${finishISO}</LateFinish>
      <StartVariance>0</StartVariance>
      <FinishVariance>0</FinishVariance>
      <PercentComplete>${act.avanceAuto}</PercentComplete>
      <PercentWorkComplete>${act.avanceAuto}</PercentWorkComplete>
      <Status>${taskStatus}</Status>
      <StatusManager>${esc(act.responsable || "")}</StatusManager>
      <Notes>${esc(`Responsable: ${act.responsable || ""}. Estado: ${act.estado || ""}. ${act.considerarFeriados ? "Incluye feriados." : "Excluye feriados."}`)}</Notes>
      <HideBar>0</HideBar>
      <Rollup>0</Rollup>
      <ConstraintType>0</ConstraintType>
      <LevelAssignments>1</LevelAssignments>
      <LevelingCanSplit>1</LevelingCanSplit>
      <LevelingDelay>0</LevelingDelay>
      <LevelingDelayFormat>8</LevelingDelayFormat>
      <IgnoreResourceCalendar>0</IgnoreResourceCalendar>
      <CalendarUID>-1</CalendarUID>
    </Task>`;
    }).join("\n");

    // ── Excepciones de calendario (feriados) ──────────────────────────────
    const holidayExceptions = state.holidays.map((h, i) => `        <Exception>
          <ExceptionType>1</ExceptionType>
          <Name>${esc(h.nombre || "Feriado")}</Name>
          <DayWorking>0</DayWorking>
          <TimePeriod>
            <FromDate>${h.fecha}T00:00:00</FromDate>
            <ToDate>${h.fecha}T23:59:00</ToDate>
          </TimePeriod>
        </Exception>`).join("\n");

    // ── Días laborales del calendario (lunes a viernes, 08-12 y 13-17) ───
    const workingDayTypes = [2, 3, 4, 5, 6]; // Mon=2, Tue=3, Wed=4, Thu=5, Fri=6
    const workingDayNodes = workingDayTypes.map(d => `        <WeekDay>
          <DayType>${d}</DayType>
          <DayWorking>1</DayWorking>
          <WorkingTimes>
            <WorkingTime>
              <FromTime>08:00:00</FromTime>
              <ToTime>12:00:00</ToTime>
            </WorkingTime>
            <WorkingTime>
              <FromTime>13:00:00</FromTime>
              <ToTime>17:00:00</ToTime>
            </WorkingTime>
          </WorkingTimes>
        </WeekDay>`).join("\n");

    const nonWorkingDayNodes = [1, 7].map(d => `        <WeekDay>
          <DayType>${d}</DayType>
          <DayWorking>0</DayWorking>
        </WeekDay>`).join("\n"); // Sun=1, Sat=7

    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <SaveVersion>14</SaveVersion>
  <Name>${esc(project.codigo)}</Name>
  <Title>${esc(project.titulo)}</Title>
  <Subject>${esc(project.descripcion || "")}</Subject>
  <Author>${esc(project.responsable || "")}</Author>
  <Company>${esc(project.cliente || "")}</Company>
  <CreationDate>${today}T00:00:00</CreationDate>
  <LastSaved>${today}T00:00:00</LastSaved>
  <ScheduleFromStart>1</ScheduleFromStart>
  <StartDate>${projStartISO}</StartDate>
  <FinishDate>${projFinishISO}</FinishDate>
  <FYStartDate>1</FYStartDate>
  <CriticalSlackLimit>0</CriticalSlackLimit>
  <CurrencyDigits>2</CurrencyDigits>
  <CurrencySymbol>S/</CurrencySymbol>
  <CurrencyCode>PEN</CurrencyCode>
  <CalendarUID>1</CalendarUID>
  <DefaultStartTime>08:00:00</DefaultStartTime>
  <DefaultFinishTime>17:00:00</DefaultFinishTime>
  <MinutesPerDay>480</MinutesPerDay>
  <MinutesPerWeek>2400</MinutesPerWeek>
  <DaysPerMonth>20</DaysPerMonth>
  <DefaultTaskType>1</DefaultTaskType>
  <DefaultFixedCostAccrual>3</DefaultFixedCostAccrual>
  <DefaultStandardRate>0</DefaultStandardRate>
  <DefaultOvertimeRate>0</DefaultOvertimeRate>
  <DurationFormat>7</DurationFormat>
  <WorkFormat>2</WorkFormat>
  <EditableActualCosts>0</EditableActualCosts>
  <HonorConstraints>0</HonorConstraints>
  <EarnedValueMethod>0</EarnedValueMethod>
  <WeekStartDay>2</WeekStartDay>
  <MoveCompletedEndsBack>0</MoveCompletedEndsBack>
  <MoveRemainingStartsBack>0</MoveRemainingStartsBack>
  <MoveRemainingStartsForward>0</MoveRemainingStartsForward>
  <MoveCompletedEndsForward>0</MoveCompletedEndsForward>
  <BaselineForEarnedValue>0</BaselineForEarnedValue>
  <AutoAddNewResourcesAndTasks>1</AutoAddNewResourcesAndTasks>
  <StatusDate>NA</StatusDate>
  <CurrentDate>${today}T00:00:00</CurrentDate>
  <MicrosoftProjectServerURL>0</MicrosoftProjectServerURL>
  <Autolink>1</Autolink>
  <NewTaskStartDate>0</NewTaskStartDate>
  <DefaultTaskEVMethod>0</DefaultTaskEVMethod>
  <ProjectExternallyEdited>0</ProjectExternallyEdited>
  <ActualsInSync>1</ActualsInSync>
  <RemoveFileProperties>0</RemoveFileProperties>
  <AdminProject>0</AdminProject>
  <Calendars>
    <Calendar>
      <UID>1</UID>
      <Name>Standard</Name>
      <IsBaseCalendar>1</IsBaseCalendar>
      <IsBaselineCalendar>0</IsBaselineCalendar>
      <BaseCalendarUID>-1</BaseCalendarUID>
      <WeekDays>
${workingDayNodes}
${nonWorkingDayNodes}
      </WeekDays>
      <Exceptions>
${holidayExceptions}
      </Exceptions>
    </Calendar>
  </Calendars>
  <Tasks>
    <Task>
      <UID>0</UID>
      <ID>0</ID>
      <Name>${esc(project.titulo)}</Name>
      <Type>1</Type>
      <IsNull>0</IsNull>
      <CreateDate>${today}T00:00:00</CreateDate>
      <WBS>0</WBS>
      <OutlineNumber>0</OutlineNumber>
      <OutlineLevel>0</OutlineLevel>
      <Priority>500</Priority>
      <Start>${projStartISO}</Start>
      <Finish>${projFinishISO}</Finish>
      <Duration>P0DT0H0M0S</Duration>
      <DurationFormat>7</DurationFormat>
      <Milestone>0</Milestone>
      <Summary>1</Summary>
      <Critical>0</Critical>
      <IsSubproject>0</IsSubproject>
      <IsSubprojectReadOnly>0</IsSubprojectReadOnly>
      <ExternalTask>0</ExternalTask>
      <PercentComplete>0</PercentComplete>
      <PercentWorkComplete>0</PercentWorkComplete>
      <HideBar>0</HideBar>
      <Rollup>0</Rollup>
      <LevelAssignments>1</LevelAssignments>
      <LevelingCanSplit>1</LevelingCanSplit>
      <LevelingDelay>0</LevelingDelay>
      <LevelingDelayFormat>8</LevelingDelayFormat>
      <IgnoreResourceCalendar>0</IgnoreResourceCalendar>
      <CalendarUID>-1</CalendarUID>
    </Task>
${taskNodes}
  </Tasks>
  <Resources/>
  <Assignments/>
</Project>`;

    App.downloadBlob(new Blob(["﻿" + xml], { type: "text/xml;charset=utf-8" }), `${project.codigo}_msproject.xml`);
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
