import React, { useState } from 'react';

const roles = ['SUPER_ADMIN', 'DIRECTOR', 'DOCENTE', 'MESA_PARTES', 'ESTUDIANTE'];
const permisos = [
  'EXPEDIENTE_CREAR',
  'EXPEDIENTE_DERIVAR',
  'EXPEDIENTE_FIRMAR',
  'CONFIG_CALENDARIO',
  'GESTION_ROLES'
];

export default function RbacPermissionMatrix() {
  const [matriz, setMatriz] = useState<Record<string, Record<string, boolean>>>({
    SUPER_ADMIN: { EXPEDIENTE_CREAR: true, EXPEDIENTE_DERIVAR: true, EXPEDIENTE_FIRMAR: true, CONFIG_CALENDARIO: true, GESTION_ROLES: true },
    DIRECTOR: { EXPEDIENTE_CREAR: true, EXPEDIENTE_DERIVAR: true, EXPEDIENTE_FIRMAR: true, CONFIG_CALENDARIO: false, GESTION_ROLES: false },
    DOCENTE: { EXPEDIENTE_CREAR: true, EXPEDIENTE_DERIVAR: false, EXPEDIENTE_FIRMAR: false, CONFIG_CALENDARIO: false, GESTION_ROLES: false },
    MESA_PARTES: { EXPEDIENTE_CREAR: true, EXPEDIENTE_DERIVAR: true, EXPEDIENTE_FIRMAR: false, CONFIG_CALENDARIO: false, GESTION_ROLES: false },
    ESTUDIANTE: { EXPEDIENTE_CREAR: true, EXPEDIENTE_DERIVAR: false, EXPEDIENTE_FIRMAR: false, CONFIG_CALENDARIO: false, GESTION_ROLES: false },
  });

  const handleCheckboxChange = (rol: string, permiso: string) => {
    setMatriz((prev) => ({
      ...prev,
      [rol]: {
        ...prev[rol],
        [permiso]: !prev[rol][permiso],
      },
    }));
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 border">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
              Permisos / Roles
            </th>
            {roles.map((rol) => (
              <th key={rol} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                {rol}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {permisos.map((permiso) => (
            <tr key={permiso} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r">
                {permiso}
              </td>
              {roles.map((rol) => (
                <td key={rol} className="px-6 py-4 whitespace-nowrap text-center">
                  <input
                    type="checkbox"
                    checked={matriz[rol]?.[permiso] || false}
                    onChange={() => handleCheckboxChange(rol, permiso)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
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