import { useEffect, useState } from 'react';
import AdminPageHeader from '../../components/administracion/AdminPageHeader';
import { apiClient } from '../../api/client';

interface BitacoraPersistida {
  id_auditoria: string;
  correlation_id: string | null;
  usuario_id: string | null;
  ip_origen: string | null;
  esquema: string;
  tabla: string;
  operacion: string;
  fecha_hora: string;
}

export default function AuditoriaPage() {
  const [registros, setRegistros] = useState<BitacoraPersistida[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    apiClient.get<{ registros: BitacoraPersistida[] }>('/api/v1/admin/auditoria/bitacora', {
      params: { limite: 100, offset: 0 }, signal: controller.signal,
    }).then(({ data }) => {
      if (!Array.isArray(data.registros)) throw new Error('Respuesta de bitácora inválida.');
      setRegistros(data.registros);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'No se pudo consultar la bitácora.');
      }
    }).finally(() => {
      if (!controller.signal.aborted) setCargando(false);
    });
    return () => controller.abort();
  }, []);

  return <main className="min-h-screen bg-slate-100 text-slate-900">
    <AdminPageHeader title="Bitácora de auditoría" description="Últimos 100 eventos persistidos en PostgreSQL. Solo lectura." />
    <section className="mx-auto max-w-7xl px-6 py-8">
      {cargando && <p role="status">Cargando bitácora…</p>}
      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}
      {!cargando && !error && registros.length === 0 && <p>No hay eventos de auditoría registrados.</p>}
      {!cargando && !error && registros.length > 0 && <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50"><tr>
            <th className="p-3">Fecha</th><th className="p-3">Operación</th>
            <th className="p-3">Tabla</th><th className="p-3">Usuario ID</th>
            <th className="p-3">IP</th><th className="p-3">Correlación</th>
          </tr></thead>
          <tbody>{registros.map((registro) => <tr key={registro.id_auditoria} className="border-t border-slate-100">
            <td className="p-3">{new Date(registro.fecha_hora).toLocaleString('es-PE', { timeZone: 'America/Lima' })}</td>
            <td className="p-3">{registro.operacion}</td>
            <td className="p-3">{registro.esquema}.{registro.tabla}</td>
            <td className="p-3 font-mono text-xs">{registro.usuario_id ?? 'Sin usuario'}</td>
            <td className="p-3">{registro.ip_origen ?? 'No registrada'}</td>
            <td className="p-3 font-mono text-xs">{registro.correlation_id ?? 'No registrada'}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  </main>;
}
