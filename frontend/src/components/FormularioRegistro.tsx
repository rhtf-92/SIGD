import React, { useState } from "react";

const provinciasUcayali = {
  "Coronel Portillo": [
    "Callería",
    "Campoverde",
    "Iparía",
    "Manantay",
    "Masisea",
    "Nueva Requena",
    "Yarinacocha",
  ],
  "Padre Abad": ["Padre Abad", "Irazola", "Curimaná", "Neshuya", "Alexander Von Humboldt"],
  Atalaya: ["Raymondi", "Sepahua", "Tahuanía", "Yuruá"],
  Purús: ["Purús"],
} as const;

type FormState = {
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string;
  domicilio: string;
  provincia: string;
  distrito: string;
  juramento: boolean;
};

const initialForm: FormState = {
  nombres: "",
  apellidos: "",
  correo: "",
  telefono: "",
  domicilio: "",
  provincia: "",
  distrito: "",
  juramento: false,
};

export default function FormularioRegistro() {
  const [form, setForm] = useState<FormState>(initialForm);

  const distritosDisponibles = form.provincia
    ? provinciasUcayali[form.provincia as keyof typeof provinciasUcayali] || []
    : [];

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = event.target;
    const { name, value } = target;

    if (name === "provincia") {
      setForm((prev) => ({
        ...prev,
        provincia: value,
        distrito: "",
      }));
      return;
    }

    if (target instanceof HTMLInputElement && target.type === "checkbox") {
      setForm((prev) => ({
        ...prev,
        [name]: target.checked,
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.nombres.trim() || !form.apellidos.trim()) {
      alert("Debe completar Nombres y Apellidos.");
      return;
    }

    if (
      !form.correo.trim() ||
      !form.telefono.trim() ||
      !form.domicilio.trim() ||
      !form.provincia.trim() ||
      !form.distrito.trim()
    ) {
      alert("Debe completar todos los campos del formulario.");
      return;
    }

    if (!/^\d{9}$/.test(form.telefono.trim())) {
      alert("El teléfono debe tener exactamente 9 dígitos.");
      return;
    }

    if (!form.juramento) {
      alert("Debe aceptar la declaración jurada.");
      return;
    }

    console.log("Formulario registrado:", form);
    alert("Solicitud registrada correctamente.");
  };

  return (
    <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(0,110,199,0.10)]">
      <header className="header-sigd px-4 py-6 sm:px-8">
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <div className="space-y-1">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-sky-100 sm:text-xs">
              I.S.T. SUIZA - PUCALLPA • PODER JUDICIAL
            </p>
            <h2 className="text-xl font-black uppercase tracking-[0.1em] text-white sm:text-2xl">
              Registro Institucional de Ciudadanos
            </h2>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6 bg-[#F8FAFC] p-4 sm:p-6 lg:p-8">
        <div className="card-sigd p-4 sm:p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-suiza-blue" />
            <h3 className="section-title">Datos Personales</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="nombres" className="mb-2 block text-[0.72rem] font-bold uppercase tracking-[0.12em] text-slate-700">
                Nombres
              </label>
              <input
                id="nombres"
                name="nombres"
                type="text"
                value={form.nombres}
                onChange={handleChange}
                placeholder="Ej. Juan Carlos"
                className="input-sigd"
              />
            </div>

            <div>
              <label htmlFor="apellidos" className="mb-2 block text-[0.72rem] font-bold uppercase tracking-[0.12em] text-slate-700">
                Apellidos
              </label>
              <input
                id="apellidos"
                name="apellidos"
                type="text"
                value={form.apellidos}
                onChange={handleChange}
                placeholder="Ej. Pérez Gómez"
                className="input-sigd"
              />
            </div>
          </div>
        </div>

        <div className="card-sigd p-4 sm:p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-suiza-fuchsia" />
            <h3 className="section-title">Datos de Contacto</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="correo" className="mb-2 block text-[0.72rem] font-bold uppercase tracking-[0.12em] text-slate-700">
                Correo Electrónico
              </label>
              <input
                id="correo"
                name="correo"
                type="email"
                value={form.correo}
                onChange={handleChange}
                placeholder="ejemplo@correo.com"
                className="input-sigd"
              />
            </div>

            <div>
              <label htmlFor="telefono" className="mb-2 block text-[0.72rem] font-bold uppercase tracking-[0.12em] text-slate-700">
                Teléfono (9 Dígitos)
              </label>
              <input
                id="telefono"
                name="telefono"
                type="tel"
                inputMode="numeric"
                value={form.telefono}
                onChange={handleChange}
                placeholder="987654321"
                maxLength={9}
                className="input-sigd"
              />
            </div>
          </div>
        </div>

        <div className="card-sigd p-4 sm:p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-suiza-yellow" />
            <h3 className="section-title">Ubicación Domiciliaria</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="domicilio" className="mb-2 block text-[0.72rem] font-bold uppercase tracking-[0.12em] text-slate-700">
                Domicilio
              </label>
              <input
                id="domicilio"
                name="domicilio"
                type="text"
                value={form.domicilio}
                onChange={handleChange}
                placeholder="Av. / Calle / Mz."
                className="input-sigd"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 md:col-span-2">
              <div>
                <label htmlFor="provincia" className="mb-2 block text-[0.72rem] font-bold uppercase tracking-[0.12em] text-slate-700">
                  Provincia
                </label>
                <select
                  id="provincia"
                  name="provincia"
                  value={form.provincia}
                  onChange={handleChange}
                  className="input-sigd"
                >
                  <option value="">Seleccione una provincia</option>
                  {Object.keys(provinciasUcayali).map((provincia) => (
                    <option key={provincia} value={provincia}>
                      {provincia}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="distrito" className="mb-2 block text-[0.72rem] font-bold uppercase tracking-[0.12em] text-slate-700">
                  Distrito
                </label>
                <select
                  id="distrito"
                  name="distrito"
                  value={form.distrito}
                  onChange={handleChange}
                  disabled={!form.provincia}
                  className="input-sigd disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">{form.provincia ? "Seleccione un distrito" : "Seleccione una provincia primero"}</option>
                  {distritosDisponibles.map((distrito) => (
                    <option key={distrito} value={distrito}>
                      {distrito}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="card-sigd p-4 sm:p-5">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="juramento"
              checked={form.juramento}
              onChange={handleChange}
              className="mt-1 h-5 w-5 rounded border-slate-300 text-suiza-blue focus:ring-suiza-blue"
            />
            <span className="text-sm leading-6 text-slate-700">
              Declaro bajo juramento que los datos ingresados son auténticos y pertenecen al solicitante.
            </span>
          </label>
        </div>

        <div className="pt-2">
          <button type="submit" className="btn-primary w-full">
            Registrar Solicitud
          </button>
        </div>
      </form>
    </div>
  );
}
