window.GanttView = (() => {
    function renderGantt(project, timeline, holidays) {
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

    return { renderGantt };
})();