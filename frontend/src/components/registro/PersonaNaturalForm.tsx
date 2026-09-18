import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { naturalSchema } from "../../schemas/registroCiudadano.schema";
import type { Natural } from "../../types/registroCiudadano";
import { UbigeoSelector } from "../common/UbigeoSelector";
import type { UbigeoDTO } from "../../data/ucayali";
import { DeclaracionJuradaCheckbox } from "./DeclaracionJuradaCheckbox";
import { ConsentimientoLey29733Modal } from "./ConsentimientoLey29733Modal";

interface PersonaNaturalFormProps {
  onSubmit: (data: Natural) => void | Promise<void>;
}

export default function PersonaNaturalForm({
  onSubmit,
}: PersonaNaturalFormProps) {
  const [isConsentimientoModalOpen, setIsConsentimientoModalOpen] =
    useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Natural>({
    resolver: zodResolver(naturalSchema),
    defaultValues: {
      tipoPersona: "NATURAL",
      nombres: "",
      apellidos: "",
      fechaNacimiento: "",
      correo: "",
      celular: "",
      tipoDocumento: "DNI",
      numeroDocumento: "",
      domicilio: {
        departamentoCodigo: "25",
        provinciaCodigo: "2501",
        distritoCodigo: "",
        direccionExacta: "",
        referencia: "",
      },
      declaracionJuradaAceptada: false,
      consentimientoLey29733: false,
      version: "1.0",
      fechaAceptacion: "",
    },
  });

  const domicilioValue = watch("domicilio");
  const declaracionJuradaAceptada = watch("declaracionJuradaAceptada");
  const consentimientoLey29733 = watch("consentimientoLey29733");

  const handleUbigeoChange = (_ubigeoCod: string, dto: UbigeoDTO) => {
    const updatedDomicilio = {
      ...domicilioValue,
      departamentoCodigo: dto.departamento.id,
      provinciaCodigo: dto.provincia?.id || "",
      distritoCodigo: dto.distrito?.id || "",
      // Mantener dirección exacta y referencia existentes
    };
    setValue("domicilio", updatedDomicilio, { shouldValidate: true, shouldDirty: true });
  };

  const handleConsentimientoChange = (checked: boolean) => {
    setValue("consentimientoLey29733", checked, {
      shouldValidate: true,
      shouldDirty: true,
    });
    setValue("fechaAceptacion", checked ? new Date().toISOString() : "", {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6"
      noValidate
    >
      {/* Tipo de Documento y Número de Documento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="tipoDocumento"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Tipo de Documento *
          </label>
          <select
            id="tipoDocumento"
            {...register("tipoDocumento")}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#006EC7] focus:border-[#006EC7] outline-none"
          >
            <option value="DNI">DNI</option>
            <option value="CE">CE</option>
          </select>
          {errors.tipoDocumento && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {errors.tipoDocumento.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="numeroDocumento"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Número de Documento *
          </label>
          <input
            id="numeroDocumento"
            type="text"
            {...register("numeroDocumento")}
            className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-[#006EC7] outline-none ${
              errors.numeroDocumento ? "border-red-500" : "border-gray-300"
            }`}
            placeholder="DNI: 8 dígitos o CE: 9-12 caracteres"
          />
          {errors.numeroDocumento && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {errors.numeroDocumento.message}
            </p>
          )}
        </div>
      </div>

      {/* Nombres y Apellidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="nombres"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Nombres *
          </label>
          <input
            id="nombres"
            type="text"
            {...register("nombres")}
            className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-[#006EC7] outline-none ${
              errors.nombres ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.nombres && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {errors.nombres.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="apellidos"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Apellidos *
          </label>
          <input
            id="apellidos"
            type="text"
            {...register("apellidos")}
            className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-[#006EC7] outline-none ${
              errors.apellidos ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.apellidos && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {errors.apellidos.message}
            </p>
          )}
        </div>
      </div>

      {/* Fecha de Nacimiento y Correo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="fechaNacimiento"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Fecha de Nacimiento *
          </label>
          <input
            id="fechaNacimiento"
            type="date"
            {...register("fechaNacimiento")}
            className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-[#006EC7] outline-none ${
              errors.fechaNacimiento ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.fechaNacimiento && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {errors.fechaNacimiento.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="correo"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Correo Electrónico *
          </label>
          <input
            id="correo"
            type="email"
            {...register("correo")}
            className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-[#006EC7] outline-none ${
              errors.correo ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.correo && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {errors.correo.message}
            </p>
          )}
        </div>
      </div>

      {/* Celular */}
      <div>
        <label
          htmlFor="celular"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Celular *
        </label>
        <input
          id="celular"
          type="tel"
          {...register("celular")}
          className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-[#006EC7] outline-none ${
            errors.celular ? "border-red-500" : "border-gray-300"
          }`}
          placeholder="987654321"
        />
        {errors.celular && (
          <p className="mt-1 text-xs text-red-600 font-medium">
            {errors.celular.message}
          </p>
        )}
      </div>

      {/* Sección de Domicilio */}
      <UbigeoSelector
        initialProvinciaId={domicilioValue.provinciaCodigo}
        initialDistritoId={domicilioValue.distritoCodigo}
        onChange={handleUbigeoChange}
      />

      {/* Dirección Exacta */}
      <div>
        <label
          htmlFor="direccionExacta"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Dirección Exacta *
        </label>
        <input
          id="direccionExacta"
          type="text"
          {...register("domicilio.direccionExacta")}
          className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-[#006EC7] outline-none ${
            errors.domicilio?.direccionExacta ? "border-red-500" : "border-gray-300"
          }`}
          placeholder="Ej. Jr. Tarapacá N° 645"
        />
        {errors.domicilio?.direccionExacta && (
          <p className="mt-1 text-xs text-red-600 font-medium">
            {errors.domicilio.direccionExacta.message}
          </p>
        )}
      </div>

      {/* Referencia */}
      <div>
        <label
          htmlFor="referencia"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Referencia
        </label>
        <input
          id="referencia"
          type="text"
          {...register("domicilio.referencia")}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#006EC7] outline-none"
        />
      </div>

      {/* Checkboxes */}
      <div className="space-y-4">
        <DeclaracionJuradaCheckbox
          checked={declaracionJuradaAceptada}
          onChange={(checked) =>
            setValue("declaracionJuradaAceptada", checked, {
              shouldValidate: true,
              shouldDirty: true,
            })
          }
          error={errors.declaracionJuradaAceptada?.message}
        />

        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consentimientoLey29733}
              onChange={(e) => handleConsentimientoChange(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-[#006EC7] focus:ring-[#006EC7]"
            />
            <span className="text-sm text-gray-700">
              He leído y acepto el consentimiento de tratamiento de datos
              personales conforme a la Ley N° 29733 *
            </span>
          </label>
          <button
            type="button"
            onClick={() => setIsConsentimientoModalOpen(true)}
            className="text-sm text-[#006EC7] underline text-left ml-7"
          >
            Ver política de tratamiento de datos personales
          </button>
          {errors.consentimientoLey29733 && (
            <p className="text-xs text-red-600 font-medium mt-1 ml-7">
              {errors.consentimientoLey29733.message}
            </p>
          )}
        </div>
      </div>

      <ConsentimientoLey29733Modal
        isOpen={isConsentimientoModalOpen}
        onClose={() => setIsConsentimientoModalOpen(false)}
      />

      {/* Botón Submit */}
      <button
        type="submit"
        disabled={
          !declaracionJuradaAceptada ||
          !consentimientoLey29733 ||
          isSubmitting
        }
        className={`w-full py-3 px-4 text-sm font-semibold text-white rounded-md transition-colors ${
          !declaracionJuradaAceptada ||
          !consentimientoLey29733 ||
          isSubmitting
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-[#006EC7] hover:bg-[#005ba8]"
        }`}
      >
        Registrar y Crear Casilla
      </button>
    </form>
  );
}
