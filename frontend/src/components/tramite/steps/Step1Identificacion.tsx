/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * ENTREGABLE: ENT-M02-01 — Asistente Wizard de Tramitación de 4 Pasos
 * ARCHIVO: src/components/tramite/steps/Step1Identificacion.tsx
 * RESPONSABLE: Anllely Melgarejo V. (F_ANLLELY)
 * COLABORADORAS: Lucy Panduro Ramos, Noelia Alva (Grupo 1)
 * 
 * DESCRIPCIÓN:
 * Subcomponente modular para el Paso 1: Identificación del Solicitante.
 * Integra:
 * - Modalidad de solicitante (Persona Natural / Persona Jurídica).
 * - Tipo de documento (DNI) con validación estricta de 8 dígitos.
 * - Nombres y apellidos completos (o Razón Social).
 * - Correo electrónico institucional y teléfono celular.
 * - Programa de Estudios oficial: SearchableSelect con las 11 carreras oficiales
 *   del IESTP "Suiza".
 * - Catálogo UBIGEO dinámico respaldado por PostgreSQL y ubigeoService (0 datos estáticos).
 * ==============================================================================
 */

import React, { useMemo, useState, useEffect } from "react";
import {
  type DatosSolicitante,
  type TipoPersona,
  type TipoDocumentoIdentidad,
  PROGRAMAS_ESTUDIO_CATALOGO,
} from "../../../types/tramiteWizard";
import TextInput from "../../common/TextInput";
import SearchableSelect, { type SelectOption } from "../../common/SearchableSelect";
import {
  fetchDepartamentos,
  fetchProvincias,
  fetchDistritos,
} from "../../../services/ubigeoService";
import type { UbigeoItem } from "../../../types/ubigeo";

export interface Step1IdentificacionProps {
  /** Datos actuales del solicitante extraídos de formData.solicitante */
  data: DatosSolicitante;
  /** Errores de validación emitidos por el validador del Paso 1 */
  errors: Record<string, string[]>;
  /** Callback para actualizar campos del solicitante en el hook */
  onChange: (fields: Partial<DatosSolicitante>) => void;
}

const OPCIONES_TIPO_DOCUMENTO: readonly SelectOption[] = [
  { value: "DNI", label: "DNI — Documento Nacional de Identidad (8 dígitos)", description: "Para ciudadanos peruanos" },
  { value: "RUC", label: "RUC — Registro Único de Contribuyentes (11 dígitos)", description: "Para personas jurídicas y empresas" },
  { value: "CE", label: "Carné de Extranjería (CE)", description: "Para residentes extranjeros" },
  { value: "PASAPORTE", label: "Pasaporte Oficial", description: "Para ciudadanos no domiciliados" },
];

export const Step1Identificacion: React.FC<Step1IdentificacionProps> = ({
  data,
  errors,
  onChange,
}) => {
  const [departamentosItems, setDepartamentosItems] = useState<UbigeoItem[]>([]);
  const [provinciasItems, setProvinciasItems] = useState<UbigeoItem[]>([]);
  const [distritosItems, setDistritosItems] = useState<UbigeoItem[]>([]);

  // 1. Carga dinámica de departamentos desde PostgreSQL
  useEffect(() => {
    let activo = true;
    fetchDepartamentos()
      .then((items) => {
        if (activo && items && items.length > 0) {
          setDepartamentosItems(items);
        }
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, []);

  // 2. Carga dinámica de provincias cuando cambia el departamento
  useEffect(() => {
    let activo = true;
    const depNombre = data.departamento || "Ucayali";
    const depEncontrado = departamentosItems.find(
      (d) => d.nombre.toLowerCase() === depNombre.toLowerCase()
    );
    const depId = depEncontrado ? depEncontrado.id : (depNombre.toLowerCase().includes("ucayali") ? "25" : "");

    if (depId) {
      fetchProvincias(depId)
        .then((items) => {
          if (activo) {
            setProvinciasItems(items);
          }
        })
        .catch(() => {
          if (activo) setProvinciasItems([]);
        });
    } else {
      setProvinciasItems([]);
    }
    return () => {
      activo = false;
    };
  }, [data.departamento, departamentosItems]);

  // 3. Carga dinámica de distritos cuando cambia la provincia
  useEffect(() => {
    let activo = true;
    const provNombre = data.provincia || "";
    const provEncontrada = provinciasItems.find(
      (p) => p.nombre.toLowerCase() === provNombre.toLowerCase()
    );

    if (provEncontrada) {
      fetchDistritos(provEncontrada.id)
        .then((items) => {
          if (activo) {
            setDistritosItems(items);
          }
        })
        .catch(() => {
          if (activo) setDistritosItems([]);
        });
    } else {
      setDistritosItems([]);
    }
    return () => {
      activo = false;
    };
  }, [data.provincia, provinciasItems]);

  // Mapeo a SelectOptions de departamentos (PostgreSQL como única fuente de verdad)
  const opcionesDepartamentos: readonly SelectOption[] = useMemo(() => {
    if (departamentosItems.length > 0) {
      return departamentosItems.map((d) => ({
        value: d.nombre,
        label: d.id === "25" ? "Ucayali (Sede Institucional Pucallpa)" : d.nombre,
      }));
    }
    return [];
  }, [departamentosItems]);

  // Mapeo a SelectOptions de provincias (PostgreSQL como única fuente de verdad)
  const opcionesProvincias: readonly SelectOption[] = useMemo(() => {
    if (provinciasItems.length > 0) {
      return provinciasItems.map((prov) => ({
        value: prov.nombre,
        label: `Provincia de ${prov.nombre}`,
      }));
    }
    return [];
  }, [provinciasItems]);

  // Mapeo a SelectOptions de distritos (PostgreSQL como única fuente de verdad)
  const opcionesDistritos: readonly SelectOption[] = useMemo(() => {
    if (distritosItems.length > 0) {
      return distritosItems.map((dist) => ({
        value: dist.nombre,
        label: dist.nombre,
      }));
    }
    if (data.distrito) {
      return [{ value: data.distrito, label: data.distrito }];
    }
    return [];
  }, [distritosItems, data.distrito]);

  const handleTipoPersonaChange = (tipo: TipoPersona) => {
    onChange({
      tipoPersona: tipo,
      tipoDocumento: tipo === "JURIDICA" ? "RUC" : "DNI",
      numeroDocumento: "",
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Selector de Tipo de Persona */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
          Modalidad de Solicitante *
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleTipoPersonaChange("NATURAL")}
            className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition cursor-pointer ${
              data.tipoPersona === "NATURAL"
                ? "border-[#006EC7] bg-blue-50/60 text-[#006EC7] font-semibold shadow-xs"
                : "border-slate-200 hover:border-slate-300 text-slate-700 bg-white"
            }`}
          >
            <div>
              <p className="text-sm font-bold text-slate-900">Persona Natural</p>
              <p className="text-xs text-slate-500">Estudiantes, egresados, docentes y ciudadanos</p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded bg-blue-100/80 text-blue-800">
              DNI
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTipoPersonaChange("JURIDICA")}
            className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition cursor-pointer ${
              data.tipoPersona === "JURIDICA"
                ? "border-[#006EC7] bg-blue-50/60 text-[#006EC7] font-semibold shadow-xs"
                : "border-slate-200 hover:border-slate-300 text-slate-700 bg-white"
            }`}
          >
            <div>
              <p className="text-sm font-bold text-slate-900">Persona Jurídica</p>
              <p className="text-xs text-slate-500">Empresas, instituciones públicas y privadas</p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded bg-blue-100/80 text-blue-800">
              RUC
            </span>
          </button>
        </div>
      </div>

      {/* 2. Documento de Identidad */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-1">
          <SearchableSelect
            label="Tipo de Documento"
            required
            options={OPCIONES_TIPO_DOCUMENTO}
            value={data.tipoDocumento}
            onChange={(val) =>
              onChange({ tipoDocumento: val as TipoDocumentoIdentidad })
            }
            placeholder="Seleccione tipo..."
          />
        </div>

        <div className="sm:col-span-2">
          <TextInput
            label={data.tipoDocumento === "DNI" ? "Número de DNI (8 dígitos numéricos)" : "Número de Documento"}
            required
            value={data.numeroDocumento}
            onChange={(e) => {
              const soloDigitos = e.target.value.replace(/[^0-9]/g, "");
              if (data.tipoDocumento === "DNI" || data.tipoDocumento === "RUC") {
                onChange({ numeroDocumento: soloDigitos });
              } else {
                onChange({ numeroDocumento: e.target.value });
              }
            }}
            placeholder={
              data.tipoDocumento === "DNI"
                ? "Ej. 47891234 (exactamente 8 dígitos)"
                : data.tipoDocumento === "RUC"
                ? "Ej. 20493012941 (11 dígitos)"
                : "Ingrese número de documento"
            }
            maxLength={data.tipoDocumento === "DNI" ? 8 : data.tipoDocumento === "RUC" ? 11 : 15}
            error={errors.numeroDocumento?.[0]}
            helperText={
              data.tipoDocumento === "DNI" && data.numeroDocumento.length > 0 && data.numeroDocumento.length < 8
                ? `Faltan ${8 - data.numeroDocumento.length} dígitos para completar el DNI.`
                : undefined
            }
          />
        </div>
      </div>

      {/* 3. Nombres y Apellidos o Razón Social */}
      {data.tipoPersona === "JURIDICA" ? (
        <TextInput
          label="Razón Social / Denominación de la Entidad"
          required
          value={data.razonSocial || ""}
          onChange={(e) => onChange({ razonSocial: e.target.value })}
          placeholder="Ej. Inversiones y Servicios Educativos Amazónicos S.A.C."
          error={errors.razonSocial?.[0]}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextInput
            label="Nombres Completos"
            required
            value={data.nombres}
            onChange={(e) => onChange({ nombres: e.target.value })}
            placeholder="Ej. Juan Carlos"
            error={errors.nombres?.[0]}
          />
          <TextInput
            label="Apellidos Completos"
            required
            value={data.apellidos}
            onChange={(e) => onChange({ apellidos: e.target.value })}
            placeholder="Ej. Pérez Huamán"
            error={errors.apellidos?.[0]}
          />
        </div>
      )}

      {/* 4. Programa de Estudios: SearchableSelect con las 11 Carreras Oficiales del IESTP Suiza */}
      {data.tipoPersona === "NATURAL" && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-2">
          <SearchableSelect
            label="Programa de Estudios (Carrera Profesional)"
            required
            options={PROGRAMAS_ESTUDIO_CATALOGO}
            value={data.programaEstudios || ""}
            onChange={(val) => onChange({ programaEstudios: val })}
            placeholder="Seleccione su carrera profesional..."
            clearable={true}
            searchPlaceholder="Buscar carrera (ej. Sistemas, Contabilidad, Enfermería)..."
            error={errors.programaEstudios?.[0]}
            helperText="Catálogo oficial con las 11 carreras técnicas profesionales autorizadas del IESTP Suiza."
          />
        </div>
      )}

      {/* 5. Canales de Contacto */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          label="Correo Electrónico (Notificaciones Oficiales)"
          type="email"
          required
          value={data.correo}
          onChange={(e) => onChange({ correo: e.target.value })}
          placeholder="ejemplo@estudiantes.iestpsuiza.edu.pe"
          error={errors.correo?.[0]}
          helperText="Canal vinculante de acuerdo al Art. 20 del TUO de la Ley N° 27444."
        />

        <TextInput
          label="Teléfono Celular"
          type="tel"
          maxLength={9}
          required
          value={data.celular}
          onChange={(e) => {
            const soloDigitos = e.target.value.replace(/[^0-9]/g, "");
            onChange({ celular: soloDigitos });
          }}
          placeholder="961234567"
          error={errors.celular?.[0]}
          helperText="9 dígitos que inicien con 9 para notificaciones por SMS."
        />
      </div>

      {/* 6. Domicilio y Ubigeo Dinámico */}
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Ubicación Geográfica y Domicilio
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SearchableSelect
            label="Departamento"
            required
            options={opcionesDepartamentos}
            value={data.departamento}
            onChange={(val) => {
              onChange({
                departamento: val,
                provincia: "",
                distrito: "",
              });
            }}
            placeholder="Seleccione departamento..."
          />

          <SearchableSelect
            label="Provincia"
            required
            options={opcionesProvincias}
            value={data.provincia}
            onChange={(val) => {
              onChange({
                provincia: val,
                distrito: "",
              });
            }}
            placeholder="Seleccione provincia..."
          />

          <SearchableSelect
            label="Distrito"
            required
            options={opcionesDistritos}
            value={data.distrito}
            onChange={(val) => onChange({ distrito: val })}
            placeholder="Seleccione distrito..."
          />
        </div>

        <TextInput
          label="Dirección Domiciliaria / Referencia"
          value={data.direccion || ""}
          onChange={(e) => onChange({ direccion: e.target.value })}
          placeholder="Ej. Jr. Tacna 540, Int. 2B (Ref. frente a Plaza de Armas de Pucallpa)"
        />
      </div>
    </div>
  );
};

export default Step1Identificacion;
