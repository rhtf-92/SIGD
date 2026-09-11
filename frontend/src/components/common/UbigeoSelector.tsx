import React, { useState, useMemo } from 'react';

export interface DistritoOption {
  codigo: string;
  nombre: string;
}

export interface ProvinciaOption {
  codigo: string;
  nombre: string;
  distritos: DistritoOption[];
}

export interface UbigeoData {
  departamentoCodigo: string;
  provinciaCodigo: string;
  distritoCodigo: string;
  direccionExacta: string;
  referencia?: string;
}

interface UbigeoSelectorProps {
  value: UbigeoData;
  onChange: (data: UbigeoData) => void;
  errorDistrito?: string;
  errorDireccion?: string;
}

// Catálogo oficial SIAGIE / INEI de la Región Ucayali
export const UCAYALI_PROVINCIAS: ProvinciaOption[] = [
  {
    codigo: '2501',
    nombre: 'Coronel Portillo',
    distritos: [
      { codigo: '250101', nombre: 'Callería' },
      { codigo: '250102', nombre: 'Campoverde' },
      { codigo: '250103', nombre: 'Iparía' },
      { codigo: '250104', nombre: 'Masisea' },
      { codigo: '250105', nombre: 'Yarinacocha' },
      { codigo: '250106', nombre: 'Nueva Requena' },
      { codigo: '250107', nombre: 'Manantay' },
    ],
  },
  {
    codigo: '2502',
    nombre: 'Padre Abad',
    distritos: [
      { codigo: '250201', nombre: 'Padre Abad' },
      { codigo: '250202', nombre: 'Irazola' },
      { codigo: '250203', nombre: 'Curimaná' },
      { codigo: '250204', nombre: 'Neshuya' },
      { codigo: '250205', nombre: 'Alexander Von Humboldt' },
      { codigo: '250206', nombre: 'Boquerón' },
      { codigo: '250207', nombre: 'Huipoca' },
    ],
  },
  {
    codigo: '2503',
    nombre: 'Atalaya',
    distritos: [
      { codigo: '250301', nombre: 'Raimondi' },
      { codigo: '250302', nombre: 'Sepahua' },
      { codigo: '250303', nombre: 'Tahuanía' },
      { codigo: '250304', nombre: 'Yurúa' },
    ],
  },
  {
    codigo: '2504',
    nombre: 'Purús',
    distritos: [
      { codigo: '250401', nombre: 'Purús' },
    ],
  },
];

export const UbigeoSelector: React.FC<UbigeoSelectorProps> = ({
  value,
  onChange,
  errorDistrito,
  errorDireccion,
}) => {
  const [selectedProvincia, setSelectedProvincia] = useState<string>(
    value.provinciaCodigo || '2501'
  );

  // Distritos filtrados según la provincia seleccionada
  const distritosDisponibles = useMemo(() => {
    const prov = UCAYALI_PROVINCIAS.find((p) => p.codigo === selectedProvincia);
    return prov ? prov.distritos : [];
  }, [selectedProvincia]);

  const handleProvinciaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuevaProvincia = e.target.value;
    setSelectedProvincia(nuevaProvincia);
    
    // Al cambiar de provincia se resetea automáticamente el distrito seleccionado
    onChange({
      ...value,
      provinciaCodigo: nuevaProvincia,
      distritoCodigo: '', // Vacío para obligar a seleccionar
    });
  };

  const handleDistritoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...value,
      distritoCodigo: e.target.value,
    });
  };

  const handleDireccionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...value,
      direccionExacta: e.target.value,
    });
  };

  const handleReferenciaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...value,
      referencia: e.target.value,
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-[#006EC7]">
        Ubicación y Domicilio Actual (Región Ucayali)
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Departamento (Fijo en primera etapa) */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Departamento
          </label>
          <input
            type="text"
            value="Ucayali (25)"
            disabled
            className="w-full px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded-md text-gray-500 cursor-not-allowed"
          />
        </div>

        {/* Provincia Dependiente */}
        <div>
          <label 
            htmlFor="provincia-select"
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            Provincia *
          </label>
          <select
            id="provincia-select"
            value={selectedProvincia}
            onChange={handleProvinciaChange}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#006EC7] focus:border-[#006EC7] outline-none"
          >
            {UCAYALI_PROVINCIAS.map((prov) => (
              <option key={prov.codigo} value={prov.codigo}>
                {prov.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Distrito Dependiente */}
        <div>
          <label 
            htmlFor="distrito-select"
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            Distrito *
          </label>
          <select
            id="distrito-select"
            value={value.distritoCodigo}
            onChange={handleDistritoChange}
            className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-[#006EC7] outline-none ${
              errorDistrito ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">-- Seleccione Distrito --</option>
            {distritosDisponibles.map((dist) => (
              <option key={dist.codigo} value={dist.codigo}>
                {dist.nombre}
              </option>
            ))}
          </select>
          {errorDistrito && (
            <p className="mt-1 text-xs text-red-600 font-medium">{errorDistrito}</p>
          )}
        </div>
      </div>

      {/* Dirección Exacta y Referencia */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label 
            htmlFor="direccion-exacta"
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            Dirección Exacta (Calle, Jr, Av, N°, Mz, Lote) *
          </label>
          <input
            id="direccion-exacta"
            type="text"
            value={value.direccionExacta}
            onChange={handleDireccionChange}
            placeholder="Ej. Jr. Tarapacá N° 645"
            className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-[#006EC7] outline-none ${
              errorDireccion ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errorDireccion && (
            <p className="mt-1 text-xs text-red-600 font-medium">{errorDireccion}</p>
          )}
        </div>

        <div>
          <label 
            htmlFor="referencia-domicilio"
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            Referencia de Ubicación (Opcional)
          </label>
          <input
            id="referencia-domicilio"
            type="text"
            value={value.referencia || ''}
            onChange={handleReferenciaChange}
            placeholder="Ej. A espaldas del Hospital Regional"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#006EC7] outline-none"
          />
        </div>
      </div>
    </div>
  );
};