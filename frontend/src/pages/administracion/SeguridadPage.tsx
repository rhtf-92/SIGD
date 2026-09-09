import { useMemo, useState } from "react";

import AdminPageHeader from "../../components/administracion/AdminPageHeader";

interface CuentaBloqueada {
  id: number;
  usuario: string;
  correo: string;
  motivo: string;
  fecha: string;
}

interface IntentoAcceso {
  id: number;
  fecha: string;
  usuario: string;
  ip: string;
  resultado: "Correcto" | "Fallido";
}

const intentos: IntentoAcceso[] = [
  { id: 1, fecha: "29/08/2026 10:20", usuario: "jperez@institutosuiza.edu.pe", ip: "192.168.1.18", resultado: "Correcto" },
  { id: 2, fecha: "29/08/2026 09:57", usuario: "atorres@institutosuiza.edu.pe", ip: "192.168.1.42", resultado: "Fallido" },
  { id: 3, fecha: "29/08/2026 09:56", usuario: "atorres@institutosuiza.edu.pe", ip: "192.168.1.42", resultado: "Fallido" },
  { id: 4, fecha: "29/08/2026 09:55", usuario: "atorres@institutosuiza.edu.pe", ip: "192.168.1.42", resultado: "Fallido" },
  { id: 5, fecha: "29/08/2026 08:35", usuario: "mlopez@institutosuiza.edu.pe", ip: "192.168.1.25", resultado: "Correcto" },
];

const cuentasIniciales: CuentaBloqueada[] = [
  {
    id: 1,
    usuario: "Ana Torres García",
    correo: "atorres@institutosuiza.edu.pe",
    motivo: "Exceso de intentos fallidos",
    fecha: "29/08/2026 09:57",
  },
];

export default function SeguridadPage() {
  const [cuentasBloqueadas, setCuentasBloqueadas] = useState(cuentasIniciales);
  const [maxIntentos, setMaxIntentos] = useState(5);
  const [minutosBloqueo, setMinutosBloqueo] = useState(30);
  const [minutosSesion, setMinutosSesion] = useState(30);
  const [mensaje, setMensaje] = useState("");

  const fallidos = useMemo(
    () => intentos.filter((intento) => intento.resultado === "Fallido").length,
    [],
  );

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AdminPageHeader
        title="Seguridad"
        description="Control de accesos, bloqueos e intentos fallidos de autenticación."
      />

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Cuentas bloqueadas</p>
            <p className="mt-2 text-3xl font-bold">{cuentasBloqueadas.length}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Intentos fallidos visibles</p>
            <p className="mt-2 text-3xl font-bold">{fallidos}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Sesión configurada</p>
            <p className="mt-2 text-3xl font-bold">{minutosSesion} min</p>
          </article>
        </div>

        {mensaje && (
          <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {mensaje}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Políticas de acceso</h2>
            <p className="mt-1 text-sm text-slate-500">
              Parámetros de demostración para su futura integración con autenticación.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">
                  Máximo de intentos fallidos
                </label>
                <input
                  type="number"
                  min={1}
                  value={maxIntentos}
                  onChange={(event) => setMaxIntentos(Number(event.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold">
                  Duración del bloqueo (minutos)
                </label>
                <input
                  type="number"
                  min={1}
                  value={minutosBloqueo}
                  onChange={(event) => setMinutosBloqueo(Number(event.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold">
                  Tiempo de sesión (minutos)
                </label>
                <input
                  type="number"
                  min={5}
                  value={minutosSesion}
                  onChange={(event) => setMinutosSesion(Number(event.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  setMensaje(
                    `Políticas preparadas: ${maxIntentos} intentos, ${minutosBloqueo} min de bloqueo y ${minutosSesion} min de sesión.`,
                  )
                }
                className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Guardar políticas
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Cuentas bloqueadas</h2>

            <div className="mt-5 space-y-3">
              {cuentasBloqueadas.length === 0 ? (
                <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700">
                  No hay cuentas bloqueadas en la vista actual.
                </div>
              ) : (
                cuentasBloqueadas.map((cuenta) => (
                  <div
                    key={cuenta.id}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold">{cuenta.usuario}</p>
                        <p className="text-xs text-slate-500">{cuenta.correo}</p>
                        <p className="mt-2 text-sm text-slate-600">
                          {cuenta.motivo}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{cuenta.fecha}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCuentasBloqueadas((actuales) =>
                            actuales.filter((item) => item.id !== cuenta.id),
                          );
                          setMensaje(
                            `Cuenta de ${cuenta.usuario} desbloqueada en la vista de demostración.`,
                          );
                        }}
                        className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        Desbloquear
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="font-bold">Últimos intentos de acceso</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3">Fecha</th>
                  <th className="px-6 py-3">Usuario</th>
                  <th className="px-6 py-3">IP</th>
                  <th className="px-6 py-3">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {intentos.map((intento) => (
                  <tr key={intento.id}>
                    <td className="px-6 py-4 text-sm">{intento.fecha}</td>
                    <td className="px-6 py-4 text-sm">{intento.usuario}</td>
                    <td className="px-6 py-4 font-mono text-xs">{intento.ip}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          intento.resultado === "Correcto"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {intento.resultado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
