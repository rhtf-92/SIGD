import type { DashboardUnitOption } from "@/hooks/useDashboardMetrics";

export type DashboardPeriodMode = "year" | "month" | "custom";

interface TimeFilterControlsProps {
  year: number;
  mode: DashboardPeriodMode;
  month: string;
  rangeStart: string;
  rangeEnd: string;
  unitId: string;
  units: DashboardUnitOption[];
  onYearChange: (year: number) => void;
  onModeChange: (mode: DashboardPeriodMode) => void;
  onMonthChange: (month: string) => void;
  onRangeStartChange: (date: string) => void;
  onRangeEndChange: (date: string) => void;
  onUnitChange: (unitId: string) => void;
}

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const fieldClass = "input-sigd mt-1";

export default function TimeFilterControls({
  year,
  mode,
  month,
  rangeStart,
  rangeEnd,
  unitId,
  units,
  onYearChange,
  onModeChange,
  onMonthChange,
  onRangeStartChange,
  onRangeEndChange,
  onUnitChange,
}: TimeFilterControlsProps) {
  return (
    <section aria-label="Filtros del tablero" className="card-sigd grid min-w-0 grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
      <label className="min-w-0 text-sm font-medium text-slate-700">
        Año
        <select className={fieldClass} value={year} onChange={(event) => onYearChange(Number(event.target.value))}>
          {[2024, 2025, 2026, 2027, 2028].map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <label className="min-w-0 text-sm font-medium text-slate-700">
        Periodo
        <select className={fieldClass} value={mode} onChange={(event) => onModeChange(event.target.value as DashboardPeriodMode)}>
          <option value="year">Año completo</option>
          <option value="month">Mes específico</option>
          <option value="custom">Rango personalizado</option>
        </select>
      </label>
      {mode === "month" ? (
        <label className="min-w-0 text-sm font-medium text-slate-700">
          Mes
          <select className={fieldClass} value={month} onChange={(event) => onMonthChange(event.target.value)}>
            {monthNames.map((name, index) => <option key={name} value={String(index + 1).padStart(2, "0")}>{name}</option>)}
          </select>
        </label>
      ) : mode === "custom" ? (
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2">
          <label className="min-w-0 text-sm font-medium text-slate-700">
            Desde
            <input className={fieldClass} type="date" value={rangeStart} max={rangeEnd} onChange={(event) => onRangeStartChange(event.target.value)} />
          </label>
          <label className="min-w-0 text-sm font-medium text-slate-700">
            Hasta
            <input className={fieldClass} type="date" value={rangeEnd} min={rangeStart} onChange={(event) => onRangeEndChange(event.target.value)} />
          </label>
        </div>
      ) : null}
      <label className="min-w-0 text-sm font-medium text-slate-700">
        Unidad orgánica
        <select className={fieldClass} value={unitId} onChange={(event) => onUnitChange(event.target.value)}>
          <option value="">Todas las unidades</option>
          {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
        </select>
      </label>
    </section>
  );
}