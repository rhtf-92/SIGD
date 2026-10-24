import { useEffect, useState } from 'react';
import AdminPageHeader from '../../components/administracion/AdminPageHeader';
import { apiClient } from '../../api/client';

interface DiaPersistido {
  id_calendario: string;
  fecha: string;
  descripcion: string;
  tipo_feriado: string | null;
  unidad_territorial: string;
  es_laborable: boolean;
  base_legal: string | null;
}

export default function CalendarioLaboralPage() {
  const [dias, setDias] = useState<DiaPersistido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    apiClient.get<{ calendario: DiaPersistido[] }>('/api/v1/admin/calendario-laboral', {
      signal: controller.signal,
    }).then(({ data }) => {
      if (!Array.isArray(data.calendario)) throw new Error('Respuesta de calendario inválida.');
      setDias(data.calendario);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'No se pudo consultar el calendario.');
      }
    }).finally(() => {
      if (!controller.signal.aborted) setCargando(false);
    });
    return () => controller.abort();
  }, []);

  return <main className="min-h-screen bg-slate-100 text-slate-900">
    <AdminPageHeader title="Calendario laboral" description="Días persistidos en el calendario institucional. Solo lectura." />
    <section className="mx-auto max-w-5xl px-6 py-8">
      {cargando && <p role="status">Cargando calendario…</p>}
      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}
      {!cargando && !error && dias.length === 0 && <p>No hay días registrados para el período consultado.</p>}
      {!cargando && !error && dias.length > 0 && <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50"><tr><th className="p-3">Fecha</th><th className="p-3">Descripción</th><th className="p-3">Tipo</th><th className="p-3">Ámbito</th><th className="p-3">Laborable</th><th className="p-3">Base legal</th></tr></thead>
          <tbody>{dias.map((dia) => <tr key={dia.id_calendario} className="border-t border-slate-100">
            <td className="p-3">{dia.fecha}</td><td className="p-3">{dia.descripcion}</td>
            <td className="p-3">{dia.tipo_feriado ?? 'No aplica'}</td><td className="p-3">{dia.unidad_territorial}</td>
            <td className="p-3">{dia.es_laborable ? 'Sí' : 'No'}</td><td className="p-3">{dia.base_legal ?? 'No consignada'}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  </main>;
}
