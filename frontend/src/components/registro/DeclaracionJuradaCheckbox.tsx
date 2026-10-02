interface DeclaracionJuradaCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  id?: string;
}

export function DeclaracionJuradaCheckbox({
  checked,
  onChange,
  error,
  id = "declaracion-jurada-checkbox",
}: DeclaracionJuradaCheckboxProps) {
  const hasError = Boolean(error);
  const errorId = hasError ? `${id}-error` : undefined;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-required="true"
          aria-invalid={hasError}
          aria-describedby={errorId}
          className="mt-1 h-4 w-4 accent-[#006EC7]"
        />
        <label htmlFor={id} className="text-sm text-slate-700 leading-5">
          Declaro bajo juramento que toda la información consignada y los documentos adjuntados son auténticos, legítimos y reflejan la verdad. Asimismo, autorizo expresamente al IESTP 'Suiza' para el tratamiento de mis datos personales según la Ley N° 29733 y acepto que toda notificación oficial sea remitida válidamente a mi Casilla Electrónica Institucional conforme al Art. 20 del TUO de la Ley N° 27444.
        </label>
      </div>
      <p className="text-sm text-amber-700">
        Conozco que cometer falsedad en esta declaración acarrea las sanciones administrativas y penales previstas en el Art. 411 del Código Penal.
      </p>
      {hasError && (
        <span id={errorId} role="alert" className="text-sm text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}
