import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { juridicalSchema } from "../../schemas/registroCiudadano.schema";
import type { Juridical } from "../../types/registroCiudadano";
import { UbigeoSelector } from "../common/UbigeoSelector";

interface PersonaJuridicaFormProps {
  onSubmit: (data: Juridical) => void | Promise<void>;
}

export default function PersonaJuridicaForm({
  onSubmit,
}: PersonaJuridicaFormProps) {
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
      consentimientoDatosPersonales: false,
    },
  });

  const domicilioValue = watch("domicilio");

  const handleUbigeoChange = (data: typeof domicilioValue) => {
    setValue("domicilio", data, { shouldValidate: true, shouldDirty: true });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6"
      noValidate
    >
      {/* RUC y Razón Social */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="ruc"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            RUC *
          </label>
          <input
            id="ruc"
            type="text"
            {...register("ruc")}
            className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-[#006EC7] outline-none ${
              errors.ruc ? "border-red-500" : "border-gray-300"
            }`}
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
          <label
            htmlFor="razonSocial"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Razón Social *
          </label>
          <input
            id="razonSocial"
            type="text"
            {...register("razonSocial")}
            className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-[#006EC7] outline-none ${
              errors.razonSocial ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.razonSocial && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {errors.razonSocial.message}
            </p>
          )}
        </div>
      </div>

      {/* Sección Representante Legal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="representanteTipoDocumento"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Tipo de Documento *
          </label>
          <select
            id="representanteTipoDocumento"
            {...register("representanteLegal.tipoDocumento")}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#006EC7] focus:border-[#006EC7] outline-none"
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
          <label
            htmlFor="representanteNumeroDocumento"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Número de Documento *
          </label>
          <input
            id="representanteNumeroDocumento"
            type="text"
            {...register("representanteLegal.numeroDocumento")}
            className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-[#006EC7] outline-none ${
              errors.representanteLegal?.numeroDocumento ? "border-red-500" : "border-gray-300"
            }`}
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
          <label
            htmlFor="representanteNombres"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Nombres *
          </label>
          <input
            id="representanteNombres"
            type="text"
            {...register("representanteLegal.nombres")}
            className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-[#006EC7] outline-none ${
              errors.representanteLegal?.nombres ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.representanteLegal?.nombres && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {errors.representanteLegal.nombres.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="representanteApellidos"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Apellidos *
          </label>
          <input
            id="representanteApellidos"
            type="text"
            {...register("representanteLegal.apellidos")}
            className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-[#006EC7] outline-none ${
              errors.representanteLegal?.apellidos ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.representanteLegal?.apellidos && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {errors.representanteLegal.apellidos.message}
            </p>
          )}
        </div>
      </div>

      <div>
        <label
          htmlFor="cargo"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Cargo *
        </label>
        <input
          id="cargo"
          type="text"
          {...register("representanteLegal.cargo")}
          className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-[#006EC7] outline-none ${
            errors.representanteLegal?.cargo ? "border-red-500" : "border-gray-300"
          }`}
          placeholder="Ej. Gerente General"
        />
        {errors.representanteLegal?.cargo && (
          <p className="mt-1 text-xs text-red-600 font-medium">
            {errors.representanteLegal.cargo.message}
          </p>
        )}
      </div>

      {/* Partida SUNARP */}
      <div>
        <label
          htmlFor="partidaSunarp"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Partida SUNARP
        </label>
        <input
          id="partidaSunarp"
          type="text"
          {...register("partidaSunarp")}
          className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-[#006EC7] outline-none ${
            errors.partidaSunarp ? "border-red-500" : "border-gray-300"
          }`}
        />
        {errors.partidaSunarp && (
          <p className="mt-1 text-xs text-red-600 font-medium">
            {errors.partidaSunarp.message}
          </p>
        )}
      </div>

      {/* Correo Corporativo y Celular */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="correoCorporativo"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Correo Corporativo *
          </label>
          <input
            id="correoCorporativo"
            type="email"
            {...register("correoCorporativo")}
            className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-[#006EC7] outline-none ${
              errors.correoCorporativo ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.correoCorporativo && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {errors.correoCorporativo.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="celularContacto"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Celular de Contacto *
          </label>
          <input
            id="celularContacto"
            type="tel"
            {...register("celularContacto")}
            className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-[#006EC7] outline-none ${
              errors.celularContacto ? "border-red-500" : "border-gray-300"
            }`}
            placeholder="987654321"
          />
          {errors.celularContacto && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {errors.celularContacto.message}
            </p>
          )}
        </div>
      </div>

      {/* Sección de Domicilio */}
      <UbigeoSelector
        value={domicilioValue}
        onChange={handleUbigeoChange}
        errorDistrito={errors.domicilio?.distritoCodigo?.message}
        errorDireccion={errors.domicilio?.direccionExacta?.message}
      />

      {/* Checkboxes */}
      <div className="space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            {...register("declaracionJuradaAceptada")}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-[#006EC7] focus:ring-[#006EC7]"
          />
          <span className="text-sm text-gray-700">
            He leído y acepto la declaración jurada *
          </span>
        </label>
        {errors.declaracionJuradaAceptada && (
          <p className="text-xs text-red-600 font-medium mt-1 ml-7">
            {errors.declaracionJuradaAceptada.message}
          </p>
        )}

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            {...register("consentimientoDatosPersonales")}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-[#006EC7] focus:ring-[#006EC7]"
          />
          <span className="text-sm text-gray-700">
            He leído y acepto el consentimiento de tratamiento de datos
            personales *
          </span>
        </label>
        {errors.consentimientoDatosPersonales && (
          <p className="text-xs text-red-600 font-medium mt-1 ml-7">
            {errors.consentimientoDatosPersonales.message}
          </p>
        )}
      </div>

      {/* Botón Submit */}
      <button
        type="submit"
        disabled={
          !watch("declaracionJuradaAceptada") ||
          !watch("consentimientoDatosPersonales") ||
          isSubmitting
        }
        className={`w-full py-3 px-4 text-sm font-semibold text-white rounded-md transition-colors ${
          !watch("declaracionJuradaAceptada") ||
          !watch("consentimientoDatosPersonales") ||
          isSubmitting
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-[#006EC7] hover:bg-[#005ba8]"
        }`}
      >
        Registrar Empresa y Crear Casilla
      </button>
    </form>
  );
}