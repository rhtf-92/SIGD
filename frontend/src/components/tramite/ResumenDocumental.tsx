export interface DocumentoResumenItem {
  nombre: string;
  paginas?: number;
  folioInicio?: number;
  folioFin?: number;
  clasificacion?: 'EXPEDIENTE' | 'ANEXO';
  requisitoNombre?: string;
  peso?: number;
}

interface ResumenDocumentalProps {
  documentos: DocumentoResumenItem[];
  totalFolios: number;
  soloLectura?: boolean;
}

export function ResumenDocumental({ documentos, totalFolios }: ResumenDocumentalProps) {
  return (
    <section
      aria-label="Resumen Documental y Foliación Correlativa"
      className="rounded-xl border border-blue-200 bg-white p-4 shadow-xs space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center rounded-md bg-blue-700 px-2 py-0.5 font-mono text-[11px] font-bold text-white uppercase tracking-wider">
              Foliación Automática
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Art. 165 Ley N° 27444
            </span>
          </div>
          <h3 className="text-base font-bold text-slate-900 mt-1">
            Resumen Documental Oficial
          </h3>
          <p className="text-xs text-slate-500">
            Conteo estructural verificado por el servidor institucional
          </p>
        </div>

        <div className="flex items-center gap-3 bg-blue-50/80 border border-blue-200 rounded-xl px-4 py-2 self-start sm:self-auto">
          <div className="text-right">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-blue-900">
              Total Folios Calculados
            </span>
            <span className="text-2xl font-black text-[#005bb5] font-mono leading-none">
              {totalFolios}
            </span>
          </div>
          <span className="text-xs font-medium text-blue-800">
            {totalFolios === 1 ? 'folio' : 'folios'}
          </span>
        </div>
      </div>

      {documentos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-xs text-slate-500">
          <p className="font-medium text-slate-700">Sin documentos adjuntos</p>
          <p className="mt-0.5">
            Adjunte los archivos PDF requeridos para calcular automáticamente las páginas y folios correlativos del expediente.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold">
                <th className="py-2 px-3 w-10 text-center">#</th>
                <th className="py-2 px-3">Documento / Archivo</th>
                <th className="py-2 px-3 w-28 text-center">Clasificación</th>
                <th className="py-2 px-3 w-24 text-center">Páginas</th>
                <th className="py-2 px-3 w-36 text-center font-bold text-blue-900">Foliación Asignada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documentos.map((doc, idx) => {
                const pags = doc.paginas && doc.paginas > 0 ? doc.paginas : 1;
                const inicio = doc.folioInicio ?? (idx === 0 ? 1 : 1);
                const fin = doc.folioFin ?? (inicio + pags - 1);
                const textoFolio = inicio === fin ? `Folio ${inicio}` : `Folios ${inicio} al ${fin}`;

                return (
                  <tr key={`${doc.nombre}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-900 truncate max-w-xs sm:max-w-md">
                        Archivo: {doc.nombre}
                      </div>
                      {doc.requisitoNombre && (
                        <div className="text-[11px] text-slate-500 truncate">
                          {doc.requisitoNombre}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          doc.clasificacion === 'EXPEDIENTE'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {doc.clasificacion ?? 'EXPEDIENTE'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-700">
                      <span className="font-semibold">{pags}</span> {pags === 1 ? 'pág' : 'págs'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-block bg-blue-100/70 border border-blue-300 font-mono font-bold text-blue-900 px-2 py-0.5 rounded text-xs">
                        {textoFolio}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-[11px] text-slate-600 flex items-start gap-2">
        <svg className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="leading-snug">
          <strong>Foliación correlativa continua:</strong> Los folios son asignados sin saltos ni solapamientos conforme a las páginas útiles verificadas en cada archivo PDF. La adición, eliminación o sustitución de documentos actualiza inmediatamente la secuencia numérica oficial.
        </p>
      </div>
    </section>
  );
}

export default ResumenDocumental;
