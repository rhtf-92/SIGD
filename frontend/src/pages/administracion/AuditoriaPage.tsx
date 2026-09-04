import { useMemo, useState } from "react";

import AdminPageHeader from "../../components/administracion/AdminPageHeader";

type Resultado = "Exitoso" | "Denegado" | "Error";

interface RegistroAuditoria {
  id: string;
  fecha: string;
  usuario: string;
  rol: string;
  area: string;
  accion: string;
  modulo: string;
  registro: string;
  resultado: Resultado;
  ip: string;
}

const registros: RegistroAuditoria[] = [
  {
    id: "AUD-000145",
    fecha: "29/08/2026 10:15:22",
    usuario: "María Fernanda López",
    rol: "Responsable de Área",
    area: "Secretaría Académica",
    accion: "Derivó expediente",
    modulo: "Expedientes",
    registro: "EXP-2026-000184",
    resultado: "Exitoso",
    ip: "192.168.1.25",
  },
  {
    id: "AUD-000144",
    fecha: "29/08/2026 09:57:10",
    usuario: "Ana Torres García",
    rol: "Administrador",
    area: "Administración",
    accion: "Intento de inicio de sesión",
    modulo: "Autenticación",
    registro: "Cuenta de usuario",
    resultado: "Denegado",
    ip: "192.168.1.42",
  },
  {
    id: "AUD-000143",
    fecha: "29/08/2026 09:45:03",
    usuario: "Juan Carlos Pérez",
    rol: "Operador",
    area: "Mesa de Partes",
    accion: "Registró documento",
    modulo: "Documentos",
    registro: "DOC-2026-000322",
    resultado: "Exitoso",
    ip: "192.168.1.18",
  },
  {
    id: "AUD-000142",
    fecha: "29/08/2026 09:10:34",
    usuario: "Sistema",
    rol: "Sistema",
    area: "Seguridad",
    accion: "Bloqueó cuenta",
    modulo: "Seguridad",
    registro: "Usuario ATG-004",
    resultado: "Exitoso",
    ip: "127.0.0.1",
  },
  {
    id: "AUD-000141",
    fecha: "28/08/2026 16:31:55",
    usuario: "Luis Alberto Ramos",
    rol: "Archivador",
    area: "Archivo Central",
    accion: "Archivó expediente",
    modulo: "Expedientes",
    registro: "EXP-2026-000165",
    resultado: "Exitoso",
    ip: "192.168.1.31",
  },
];

function estiloResultado(resultado: Resultado) {
  if (resultado === "Exitoso") return "bg-emerald-100 text-emerald-700";
  if (resultado === "Denegado") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

export default function AuditoriaPage() {
  const [busqueda, setBusqueda] = useState("");
  const [modulo, setModulo] = useState("Todos");
  const [resultado, setResultado] = useState<Resultado | "Todos">("Todos");

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return registros.filter((registro) => {
      const coincideTexto =
        texto === "" ||
        registro.usuario.toLowerCase().includes(texto) ||
        registro.accion.toLowerCase().includes(texto) ||
        registro.registro.toLowerCase().includes(texto) ||
        registro.id.toLowerCase().includes(texto);

      const coincideModulo = modulo === "Todos" || registro.modulo === modulo;
      const coincideResultado =
        resultado === "Todos" || registro.resultado === resultado;

      return coincideTexto && coincideModulo && coincideResultado;
    });
  }, [busqueda, modulo, resultado]);

  function exportarCsv() {
    const cabecera = [
      "ID",
      "Fecha",
      "Usuario",
      "Rol",
      "Área",
      "Acción",
      "Módulo",
      "Registro",
      "Resultado",
      "IP",
    ];

    const filas = filtrados.map((registro) => [
      registro.id,
      registro.fecha,
      registro.usuario,
      registro.rol,
      registro.area,
      registro.accion,
      registro.modulo,
      registro.registro,
      registro.resultado,
      registro.ip,
    ]);

    const escapar = (valor: string) => `"${valor.replaceAll('"', '""')}"`;
    const csv = [cabecera, ...filas]
      .map((fila) => fila.map(escapar).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(blob);
    enlace.download = "auditoria-sigd.csv";
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AdminPageHeader
        title="Logs de Auditoría"
        description="Trazabilidad de acciones, accesos y eventos relevantes del SIGD."
      />

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          Los registros de auditoría son de consulta. La interfaz no permite
          editarlos ni eliminarlos; la inmutabilidad real debe garantizarse en
          backend y base de datos.
        </div>

        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px_auto]">
            <div>
              <label className="mb-2 block text-sm font-semibold">Buscar</label>
              <input
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Usuario, acción, expediente o ID"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">Módulo</label>
              <select
                value={modulo}
                onChange={(event) => setModulo(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option>Todos</option>
                <option>Expedientes</option>
                <option>Documentos</option>
                <option>Autenticación</option>
                <option>Seguridad</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">Resultado</label>
              <select
                value={resultado}
                onChange={(event) =>
                  setResultado(event.target.value as Resultado | "Todos")
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="Todos">Todos</option>
                <option value="Exitoso">Exitoso</option>
                <option value="Denegado">Denegado</option>
                <option value="Error">Error</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={exportarCsv}
                className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Exportar CSV
              </button>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="font-bold">Registro de eventos</h2>
            <p className="mt-1 text-xs text-slate-500">
              {filtrados.length} evento{filtrados.length === 1 ? "" : "s"} encontrado
              {filtrados.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1350px] text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">ID / Fecha</th>
                  <th className="px-5 py-3">Usuario</th>
                  <th className="px-5 py-3">Área</th>
                  <th className="px-5 py-3">Acción</th>
                  <th className="px-5 py-3">Módulo</th>
                  <th className="px-5 py-3">Registro</th>
                  <th className="px-5 py-3">Resultado</th>
                  <th className="px-5 py-3">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map((registro) => (
                  <tr key={registro.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold">{registro.id}</p>
                      <p className="text-xs text-slate-500">{registro.fecha}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold">{registro.usuario}</p>
                      <p className="text-xs text-slate-500">{registro.rol}</p>
                    </td>
                    <td className="px-5 py-4 text-sm">{registro.area}</td>
                    <td className="px-5 py-4 text-sm">{registro.accion}</td>
                    <td className="px-5 py-4 text-sm">{registro.modulo}</td>
                    <td className="px-5 py-4 text-sm font-medium">
                      {registro.registro}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${estiloResultado(
                          registro.resultado,
                        )}`}
                      >
                        {registro.resultado}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-600">
                      {registro.ip}
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
