import { useState, useEffect } from 'react';

export interface RbacPermissionMatrixProps {
  /** Matriz inicial de permisos por rol. Si se omite, se usan los valores por defecto. */
  matriz?: Record<string, Record<string, boolean>>;
  /** Callback disparado cuando el usuario cambia algún checkbox. */
  onMatrizChange?: (matriz: Record<string, Record<string, boolean>>) => void;
}

const PERMISOS_POR_DEFECTO = [
  'EXPEDIENTE_CREAR',
  'EXPEDIENTE_DERIVAR',
  'EXPEDIENTE_FIRMAR',
  'CONFIG_CALENDARIO',
  'GESTION_ROLES',
] as const;

const MATRIZ_INICIAL: Record<string, Record<string, boolean>> = {
  SUPER_ADMIN: { EXPEDIENTE_CREAR: true, EXPEDIENTE_DERIVAR: true, EXPEDIENTE_FIRMAR: true, CONFIG_CALENDARIO: true, GESTION_ROLES: true },
  DIRECTOR: { EXPEDIENTE_CREAR: true, EXPEDIENTE_DERIVAR: true, EXPEDIENTE_FIRMAR: true, CONFIG_CALENDARIO: false, GESTION_ROLES: false },
  DOCENTE: { EXPEDIENTE_CREAR: true, EXPEDIENTE_DERIVAR: false, EXPEDIENTE_FIRMAR: false, CONFIG_CALENDARIO: false, GESTION_ROLES: false },
  MESA_PARTES: { EXPEDIENTE_CREAR: true, EXPEDIENTE_DERIVAR: true, EXPEDIENTE_FIRMAR: false, CONFIG_CALENDARIO: false, GESTION_ROLES: false },
  ESTUDIANTE: { EXPEDIENTE_CREAR: true, EXPEDIENTE_DERIVAR: false, EXPEDIENTE_FIRMAR: false, CONFIG_CALENDARIO: false, GESTION_ROLES: false },
};

export default function RbacPermissionMatrix({
  matriz: matrizProp,
  onMatrizChange,
}: RbacPermissionMatrixProps) {
  const [matriz, setMatriz] = useState<Record<string, Record<string, boolean>>>(
    matrizProp ?? MATRIZ_INICIAL,
  );

  // Si la prop inicial cambia, sincronizar el estado interno.
  useEffect(() => {
    if (matrizProp) setMatriz(matrizProp);
  }, [matrizProp]);

  const roles = Object.keys(matriz);
  const permisos = PERMISOS_POR_DEFECTO;

  const handleCheckboxChange = (rol: string, permiso: string) => {
    const siguiente = {
      ...matriz,
      [rol]: {
        ...matriz[rol],
        [permiso]: !matriz[rol]?.[permiso],
      },
    };
    setMatriz(siguiente);
    onMatrizChange?.(siguiente);
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-[#eaf3fb] border">
        <thead className="bg-[#f4f8fb]">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-[#6b8aa5] uppercase tracking-wider border-r">
              Permisos / Roles
            </th>
            {roles.map((rol) => (
              <th key={rol} className="px-6 py-3 text-center text-xs font-medium text-[#6b8aa5] uppercase tracking-wider">
                {rol}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-[#eaf3fb]">
          {permisos.map((permiso) => (
            <tr key={permiso} className="hover:bg-[#f4f8fb]">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#0b2a4a] border-r">
                {permiso}
              </td>
              {roles.map((rol) => (
                <td key={rol} className="px-6 py-4 whitespace-nowrap text-center">
                  <input
                    type="checkbox"
                    checked={matriz[rol]?.[permiso] || false}
                    onChange={() => handleCheckboxChange(rol, permiso)}
                    className="h-4 w-4 text-[#006ec7] focus:ring-[#006ec7] border-[#bfe0f7] rounded cursor-pointer"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
