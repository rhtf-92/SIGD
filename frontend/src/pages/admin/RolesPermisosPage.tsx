import { useState } from 'react';
import RbacPermissionMatrix from '../../components/admin/RbacPermissionMatrix';

export default function RolesPermisosPage() {
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const handleGuardarCambios = async () => {
    setLoading(true);
    try {
      // Simulación de persistencia masiva PUT /api/v1/admin/roles-permisos
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setMensaje('Matriz de permisos RBAC actualizada correctamente.');
    } catch (error) {
      setMensaje('Error al guardar los cambios.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gestión de Matriz RBAC (5 Roles)</h1>
          <p className="text-sm text-gray-600">Configure los accesos y permisos dinámicos por rol institucional.</p>
        </div>
        <button
          onClick={handleGuardarCambios}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg shadow transition-all disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Guardar Cambios Masivos'}
        </button>
      </div>

      {mensaje && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg text-sm">
          {mensaje}
        </div>
      )}

      {/* Grilla bidimensional interactiva */}
      <div className="bg-white shadow rounded-lg p-4">
        <RbacPermissionMatrix />
      </div>
    </div>
  );
}