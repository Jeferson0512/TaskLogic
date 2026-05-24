/**
 * global.js
 * Capa global del módulo.
 * Contiene utilidades compartidas por dashboard y planificador.
 */
window.App = (() => {
  const DEFAULT_CONTROL_DATE = "2026-05-22";
  const STORAGE_KEY = "planificacion_gantt_projects_v1";

  const icons = {
    alert: "alert-triangle",
    arrowLeft: "arrow-left",
    barChart: "bar-chart-3",
    calendar: "calendar-days",
    calendarOff: "calendar-off",
    check: "check-circle-2",
    clock: "clock-3",
    download: "download",
    edit: "pencil",
    eye: "eye",
    folder: "folder-kanban",
    image: "image",
    list: "list-checks",
    plus: "plus",
    save: "save",
    search: "search",
    settings: "settings-2",
    trash: "trash-2",
    users: "users",
    x: "x",
  };

  function icon(name, size = 18) {
    const lucideName = icons[name] || name;
    return `<i data-lucide="${lucideName}" style="width:${size}px;height:${size}px"></i>`;
  }

  function renderIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function parseDate(value) {
    if (!value) return null;
    const [year, month, day] = String(value).split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  function toISO(date) {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatDate(value) {
    const date = typeof value === "string" ? parseDate(value) : value;
    if (!date) return "-";
    return date.toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function addDays(date, days) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  function diffDays(a, b) {
    const start = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const end = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((end - start) / 86400000);
  }

  function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  function uid(prefix = "ID") {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadState(fallback) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return clone(fallback);
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.projects)) return clone(fallback);
      return parsed;
    } catch (error) {
      console.warn("No se pudo leer localStorage:", error);
      return clone(fallback);
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function resetState(fallback) {
    localStorage.removeItem(STORAGE_KEY);
    return clone(fallback);
  }

  function showToast(title, message = "") {
    const root = document.getElementById("toastRoot");
    if (!root) return;

    const node = document.createElement("div");
    node.className = "toast";
    node.innerHTML = `
      <div class="toast__icon">${icon("check", 20)}</div>
      <div>
        <div class="toast__title">${escapeHtml(title)}</div>
        ${message ? `<div class="toast__message">${escapeHtml(message)}</div>` : ""}
      </div>
    `;

    root.appendChild(node);
    renderIcons();

    window.setTimeout(() => {
      node.remove();
    }, 3200);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function statusPill(status) {
    const clean = String(status || "PENDIENTE");
    return `<span class="pill pill--${escapeHtml(clean)}">${escapeHtml(clean.replace("_", " "))}</span>`;
  }

  function metricCard(iconName, label, value, hint) {
    return `
      <div class="card metric">
        <div class="metric__icon">${icon(iconName, 22)}</div>
        <div>
          <div class="metric__label">${escapeHtml(label)}</div>
          <div class="metric__value">${escapeHtml(value)}</div>
          <div class="metric__hint">${escapeHtml(hint)}</div>
        </div>
      </div>
    `;
  }

  function bind(root, selector, event, handler) {
    root.querySelectorAll(selector).forEach((el) => {
      el.addEventListener(event, handler);
    });
  }

  return {
    DEFAULT_CONTROL_DATE,
    STORAGE_KEY,
    icon,
    renderIcons,
    escapeHtml,
    parseDate,
    toISO,
    formatDate,
    addDays,
    diffDays,
    isWeekend,
    uid,
    clone,
    loadState,
    saveState,
    resetState,
    showToast,
    downloadBlob,
    statusPill,
    metricCard,
    bind,
  };
})();
