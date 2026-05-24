window.PlanificadorLogic = (() => {
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

    function calculateAutoProgress(activity, holidays, controlDate) {
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

    function getAutoStatus(activity, controlDate) {
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

    function recalculateCascade(activities, holidays, fromId) {
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

    return {
        calculateEndDate,
        calculateAutoProgress,
        getAutoStatus,
        recalculateCascade,
    };
})();