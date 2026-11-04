import { useState } from 'react';
import RbacPermissionMatrix from '../../components/admin/RbacPermissionMatrix';
import { apiClient } from '../../api/client';

export default function RolesPermisosPage() {
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [tipoMensaje, setTipoMensaje] = useState<'exito' | 'error'>('exito');

  // Matriz inicial de permisos por rol (claves: código de rol del frontend)
  const [matriz, setMatriz] = useState<Record<string, Record<string, boolean>>>({
    SUPER_ADMIN: { EXPEDIENTE_CREAR: true, EXPEDIENTE_DERIVAR: true, EXPEDIENTE_FIRMAR: true, CONFIG_CALENDARIO: true, GESTION_ROLES: true },
    DIRECTOR: { EXPEDIENTE_CREAR: true, EXPEDIENTE_DERIVAR: true, EXPEDIENTE_FIRMAR: true, CONFIG_CALENDARIO: false, GESTION_ROLES: false },
    DOCENTE: { EXPEDIENTE_CREAR: true, EXPEDIENTE_DERIVAR: false, EXPEDIENTE_FIRMAR: false, CONFIG_CALENDARIO: false, GESTION_ROLES: false },
    MESA_PARTES: { EXPEDIENTE_CREAR: true, EXPEDIENTE_DERIVAR: true, EXPEDIENTE_FIRMAR: false, CONFIG_CALENDARIO: false, GESTION_ROLES: false },
    ESTUDIANTE: { EXPEDIENTE_CREAR: true, EXPEDIENTE_DERIVAR: false, EXPEDIENTE_FIRMAR: false, CONFIG_CALENDARIO: false, GESTION_ROLES: false },
  });

  const handleMatrizChange = (siguiente: Record<string, Record<string, boolean>>) => {
    setMatriz(siguiente);
    setMensaje('');
  };

  const handleGuardarCambios = async () => {
    setLoading(true);
    setMensaje('');
    try {
      // Convierte la matriz al contrato del backend:
      // { roles: [{ codigo, permisos: string[] }] } con solo los permisos activos (true).
      const payload = {
        roles: Object.entries(matriz).map(([codigo, permisos]) => ({
          codigo,
          permisos: Object.entries(permisos)
            .filter(([, activo]) => activo)
            .map(([permiso]) => permiso),
        })),
      };

      await apiClient.put('/api/v1/admin/roles-permisos', payload);
      setMensaje('Matriz de permisos RBAC actualizada correctamente en el servidor.');
      setTipoMensaje('exito');
    } catch (error: unknown) {
      console.error('Error al guardar roles-permisos:', error);
      const mensajeError =
        error instanceof Error ? error.message : 'Error al guardar los cambios.';
      setMensaje(`Error al guardar los cambios: ${mensajeError}`);
      setTipoMensaje('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gestión de Matriz RBAC (5 Roles)</h1>
          <p className="text-sm text-gray-600">
            Configure los accesos y permisos dinámicos por rol institucional. Los cambios se envían al endpoint
            <code className="text-blue-600">PUT /api/v1/admin/roles-permisos</code> y se persisten en la base de datos.
          </p>
        </div>
        <button
          onClick={() => {
            if (
              window.confirm(
                "¿Confirma guardar los cambios masivos de la matriz RBAC?",
              )
            ) {
              handleGuardarCambios();
            }
          }}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg shadow transition-all disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Guardar Cambios Masivos'}
        </button>
      </div>

      {mensaje && (
        <div
          className={`mb-4 p-3 border rounded-lg text-sm ${
            tipoMensaje === 'exito'
              ? 'bg-green-100 border-green-400 text-green-700'
              : 'bg-red-100 border-red-400 text-red-700'
          }`}
        >
          {mensaje}
        </div>
      )}

      {/* Grilla bidimensional interactiva */}
      <div className="bg-white shadow rounded-lg p-4">
        <RbacPermissionMatrix matriz={matriz} onMatrizChange={handleMatrizChange} />
      </div>
    </div>
  );
}
