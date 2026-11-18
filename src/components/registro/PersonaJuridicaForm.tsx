import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { juridicalSchema } from "../../schemas/registroCiudadano.schema";
import type { Juridical } from "../../types/registroCiudadano";
import { UbigeoSelector } from "../common/UbigeoSelector";
import type { UbigeoDTO } from "../../data/ucayali";
import { DeclaracionJuradaCheckbox } from "./DeclaracionJuradaCheckbox";
import { ConsentimientoLey29733Modal } from "./ConsentimientoLey29733Modal";

interface PersonaJuridicaFormProps {
  onSubmit: (data: Juridical) => void | Promise<void>;
}

export default function PersonaJuridicaForm({
  onSubmit,
}: PersonaJuridicaFormProps) {
  const [isConsentimientoModalOpen, setIsConsentimientoModalOpen] =
    useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Juridical>({
    resolver: zodResolver(juridicalSchema),
    defaultValues: {
      tipoPersona: "JURIDICA",
      ruc: "",
      razonSocial: "",
      representanteLegal: {
        tipoDocumento: "DNI",
        numeroDocumento: "",
        nombres: "",
        apellidos: "",
        cargo: "",
      },
      partidaSunarp: "",
      correoCorporativo: "",
      celularContacto: "",
      domicilio: {
        departamentoCodigo: "",
        provinciaCodigo: "",
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
      <h2 className="reg-sec">Datos de la empresa</h2>

      {/* RUC y Razón Social */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="ruc" className="block mb-1">
            RUC <span className="reg-req">*</span>
          </label>
          <input
            id="ruc"
            type="text"
            {...register("ruc")}
            className={errors.ruc ? "is-bad" : ""}
            placeholder="10XXXXXXXXX o 20XXXXXXXXX"
            maxLength={11}
          />
          {errors.ruc && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {errors.ruc.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="razonSocial" className="block mb-1">
            Razón Social <span className="reg-req">*</span>
          </label>
          <input
            id="razonSocial"
            type="text"
            {...register("razonSocial")}
            className={errors.razonSocial ? "is-bad" : ""}
          />
          {errors.razonSocial && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {errors.razonSocial.message}
            </p>
          )}
        </div>
      </div>

      {/* Partida SUNARP */}
      <div>
        <label htmlFor="partidaSunarp" className="block mb-1">
          Partida SUNARP
        </label>
        <input
          id="partidaSunarp"
          type="text"
          {...register("partidaSunarp")}
          className={errors.partidaSunarp ? "is-bad" : ""}
        />
        {errors.partidaSunarp && (
          <p className="mt-1 text-xs text-red-600 font-medium">
            {errors.partidaSunarp.message}
          </p>
        )}
      </div>

      <h2 className="reg-sec">Representante legal</h2>

      {/* Sección Representante Legal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="representanteTipoDocumento" className="block mb-1">
            Tipo de Documento <span className="reg-req">*</span>
          </label>
          <select
            id="representanteTipoDocumento"
            {...register("representanteLegal.tipoDocumento")}
          >
            <option value="DNI">DNI</option>
            <option value="CE">CE</option>
          </select>
          {errors.representanteLegal?.tipoDocumento && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {errors.representanteLegal.tipoDocumento.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="representanteNumeroDocumento" className="block mb-1">
            Número de Documento <span className="reg-req">*</span>
          </label>
          <input
            id="representanteNumeroDocumento"
            type="text"
            {...register("representanteLegal.numeroDocumento")}
            className={errors.representanteLegal?.numeroDocumento ? "is-bad" : ""}
            placeholder="DNI: 8 dígitos o CE: 9-12 caracteres"
          />
          {errors.representanteLegal?.numeroDocumento && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {errors.representanteLegal.numeroDocumento.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="representanteNombres" className="block mb-1">
            Nombres <span className="reg-req">*</span>
          </label>
          <input
            id="representanteNombres"
            type="text"
            {...register("representanteLegal.nombres")}
            className={errors.representanteLegal?.nombres ? "is-bad" : ""}
          />
          {errors.representanteLegal?.nombres && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {errors.representanteLegal.nombres.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="representanteApellidos" className="block mb-1">
            Apellidos <span className="reg-req">*</span>
          </label>
          <input
            id="representanteApellidos"
            type="text"
            {...register("representanteLegal.apellidos")}
            className={errors.representanteLegal?.apellidos ? "is-bad" : ""}
          />
          {errors.representanteLegal?.apellidos && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {errors.representanteLegal.apellidos.message}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="cargo" className="block mb-1">
          Cargo <span className="reg-req">*</span>
        </label>
        <input
          id="cargo"
          type="text"
          {...register("representanteLegal.cargo")}
          className={errors.representanteLegal?.cargo ? "is-bad" : ""}
          placeholder="Ej. Gerente General"
        />
        {errors.representanteLegal?.cargo && (
          <p className="mt-1 text-xs text-red-600 font-medium">
            {errors.representanteLegal.cargo.message}
          </p>
        )}
      </div>

      <h2 className="reg-sec">Contacto</h2>

      {/* Correo Corporativo y Celular */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="correoCorporativo" className="block mb-1">
            Correo Corporativo <span className="reg-req">*</span>
          </label>
          <input
            id="correoCorporativo"
            type="email"
            {...register("correoCorporativo")}
            className={errors.correoCorporativo ? "is-bad" : ""}
          />
          {errors.correoCorporativo && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {errors.correoCorporativo.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="celularContacto" className="block mb-1">
            Celular de Contacto <span className="reg-req">*</span>
          </label>
          <input
            id="celularContacto"
            type="tel"
            {...register("celularContacto")}
            className={errors.celularContacto ? "is-bad" : ""}
            placeholder="987654321"
          />
          {errors.celularContacto && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {errors.celularContacto.message}
            </p>
          )}
        </div>
      </div>

      <h2 className="reg-sec">Ubicación y domicilio</h2>

      {/* Sección de Domicilio */}
      <UbigeoSelector
        initialProvinciaId={domicilioValue.provinciaCodigo}
        initialDistritoId={domicilioValue.distritoCodigo}
        onChange={handleUbigeoChange}
      />

      {/* Dirección Exacta */}
      <div>
        <label htmlFor="direccionExacta" className="block mb-1">
          Dirección Exacta <span className="reg-req">*</span>
        </label>
        <input
          id="direccionExacta"
          type="text"
          {...register("domicilio.direccionExacta")}
          className={errors.domicilio?.direccionExacta ? "is-bad" : ""}
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
        <label htmlFor="referencia" className="block mb-1">
          Referencia
        </label>
        <input
          id="referencia"
          type="text"
          {...register("domicilio.referencia")}
        />
      </div>

      <h2 className="reg-sec">Declaraciones</h2>

      {/* Checkboxes */}
      <div className="reg-legal">
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
            />
            <span className="text-sm text-gray-700">
              He leído y acepto el consentimiento de tratamiento de datos
              personales conforme a la Ley N° 29733 *
            </span>
          </label>
          <button
            type="button"
            onClick={() => setIsConsentimientoModalOpen(true)}
            className="reg-link"
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
      >
        Registrar Empresa y Crear Casilla
      </button>
    </form>
  );
}