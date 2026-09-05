# Selector de Ubigeo en Cascada Ucayali SIAGIE-MINEDU — Registro de Usuarios y Casilla

| Metadato | Detalle Institucional |
| :--- | :--- |
| **Código Documental** | SIGD-DOC-REGUSU-02 |
| **Módulo** | registro-usuarios-casilla / Selector de Ubigeo en Cascada Ucayali SIAGIE-MINEDU |
| **Versión** | 1.0.0-PROD |
| **Fecha de Aprobación** | 2026-09-05 |
| **Autores Reconocidos** | Matías Zumaeta, Sergio Serruche Panduro, Christiam Saúl |
| **Estado de Homologación** | Aprobado — Alineado a LPAG Ley N° 27444 y React 19 |

---

## 1. Fundamentación Técnica del Estándar SIAGIE (MINEDU)

El registro de la ubicación domiciliaria de los ciudadanos, postulantes y estudiantes del Instituto de Educación Superior Tecnológico Público "Suiza" (IESTP "Suiza" — Pucallpa) requiere un alto nivel de normalización para evitar los problemas históricos derivados del ingreso de texto libre.

En sistemas del sector público peruano, permitir que el usuario escriba manualmente su departamento, provincia y distrito genera distorsiones severas en base de datos:
- Variaciones ortográficas y tipográficas (ej. *"Yarinacocha"*, *"Yarina Cocha"*, *"yarina"*).
- Duplicidad e inconsistencia en los análisis estadísticos y reportes georreferenciados.
- Imposibilidad de interoperar con plataformas rectoras del Estado como SIAGIE (Sistema de Información de Apoyo a la Gestión de la Institución Educativa — MINEDU) o RENIEC.

Por tales motivos, el frontend adopta el estándar de **selección en cascada jerárquica**, gobernado por la codificación oficial de seis dígitos del **Instituto Nacional de Estadística e Informática (INEI)**.

---

## 2. Jerarquía de Selección en Cascada para la Región Ucayali

Dado que el IESTP "Suiza" tiene su sede y radio de acción principal en la Región Ucayali (código departamental INEI `25`), la primera etapa de producción implementa el catálogo integral y depurado de sus cuatro provincias y diecinueve distritos:

```
DEPARTAMENTO: UCAYALI (Código 25) [Fijo en Fase 1]
│
├── PROVINCIA: CORONEL PORTILLO (Código 2501)
│   ├── 250101 — Callería (Pucallpa Centro)
│   ├── 250102 — Campoverde
│   ├── 250103 — Iparía
│   ├── 250104 — Masisea
│   ├── 250105 — Yarinacocha
│   ├── 250106 — Nueva Requena
│   └── 250107 — Manantay
│
├── PROVINCIA: PADRE ABAD (Código 2502)
│   ├── 250201 — Padre Abad (Aguaytía)
│   ├── 250202 — Irazola
│   ├── 250203 — Curimaná
│   ├── 250204 — Neshuya
│   ├── 250205 — Alexander Von Humboldt
│   ├── 250206 — Boquerón
│   └── 250207 — Huipoca
│
├── PROVINCIA: ATALAYA (Código 2503)
│   ├── 250301 — Raimondi (Atalaya)
│   ├── 250302 — Sepahua
│   ├── 250303 — Tahuanía (Bolognesi)
│   └── 250304 — Yurúa (Breu)
│
└── PROVINCIA: PURÚS (Código 2504)
    └── 250401 — Purús (Puerto Esperanza)
```

---

## 3. Componente UI React 19: `UbigeoSelect`

A continuación se detalla la implementación técnica en TypeScript y React 19 del componente con control de estado dependiente y estilos Tailwind CSS 4:

```tsx
import React, { useState, useMemo, useEffect } from 'react';

// Tipos de datos para la estructura de Ubigeo
export interface DistritoOption {
  codigo: string; // Código INEI de 6 dígitos (ej. '250101')
  nombre: string;
}

export interface ProvinciaOption {
  codigo: string; // Código de 4 dígitos (ej. '2501')
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

interface UbigeoSelectProps {
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

export const UbigeoSelect: React.FC<UbigeoSelectProps> = ({
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
```

---

## 4. Persistencia en Base de Datos y Extensibilidad Nacional

### 4.1. Almacenamiento Normalizado en PostgreSQL 18
En el esquema de datos `sigd_auth.usuario_domicilio`, la ubicación se persiste utilizando el **código compuesto de 6 dígitos INEI**:
- `ubigeo_codigo CHAR(6)`: ej. `'250105'` (representa inequívocamente: Dpto 25 - Ucayali, Prov 01 - Coronel Portillo, Dist 05 - Yarinacocha).
- De este modo, la consulta a tablas maestras o la agregación de métricas geoestadísticas se resuelve de manera inmediata sin requerir búsquedas por texto.

### 4.2. Estrategia de Extensibilidad hacia los 25 Departamentos
En versiones posteriores (Fase 2 de interoperabilidad nacional):
1. Se activará el selector del primer nivel (Departamento) alimentado asíncronamente mediante el endpoint `GET /api/v1/maestras/ubigeo/departamentos`.
2. El componente `UbigeoSelect` reutilizará la misma lógica de cascada reactiva para cargar dinámicamente las provincias y distritos del departamento seleccionado mediante TanStack Query v5 con caché local en memoria.
