import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

import { elementoIconoModulo } from "../../config/iconosModulos";
import { nombreFamilia } from "../../config/taxonomiaModulos";
import type { FamiliaModulo } from "../../config/taxonomiaModulos";

export interface ModuloFicha {
  id: string;
  titulo: string;
  subtitulo?: string;
  descripcion: string;
  ruta: string;
  destacado?: boolean;
  familia?: FamiliaModulo;
}

interface TarjetaModuloProps {
  modulo: ModuloFicha;
  /** Posición en el catálogo. */
  indice?: number;
}

/**
 * Ficha de catálogo de un módulo.
 *
 * Tarjeta sobria: icono en pastilla neutra, título, descripción y una
 * llamada a la acción en azul institucional. Los accesos destacados llevan
 * un filete azul en el canto superior.
 */
export default function TarjetaModulo({ modulo }: TarjetaModuloProps) {
  return (
    <Link
      to={modulo.ruta}
      data-destacado={modulo.destacado ? "1" : undefined}
      className="ficha-modulo group flex flex-col p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="ficha-icono">
          {elementoIconoModulo(modulo.id, "h-[18px] w-[18px]")}
        </span>
        {modulo.destacado && (
          <span className="rounded-full border border-vault-azul/30 bg-vault-azul-lavado px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-vault-azul-tinta">
            Prioritario
          </span>
        )}
      </div>

      <h3 className="ficha-titulo mt-4">{modulo.titulo}</h3>

      {modulo.subtitulo && (
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-tinta-400">
          {modulo.subtitulo}
        </p>
      )}

      <p className="ficha-descripcion mt-2">{modulo.descripcion}</p>

      <div className="ficha-division mt-auto flex items-center justify-between gap-3 pt-3.5">
        <span className="ficha-sello">{nombreFamilia(modulo.familia)}</span>
        <span className="ficha-cta">
          Abrir
          <ArrowUpRight
            className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden="true"
          />
        </span>
      </div>
    </Link>
  );
}
