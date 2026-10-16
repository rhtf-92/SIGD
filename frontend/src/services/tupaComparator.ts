import type { TupaTramite } from "./tupaApi";

export type TupaDifferenceKind = "Nuevo" | "Retirado" | "Modificado";

export interface TupaDifference {
  tipo: TupaDifferenceKind;
  codigo: string;
  denominacion: string;
  cambios: { campo: string; antes: string; despues: string }[];
}

const campos = [
  ["derecho_monto", "Derecho de tramitación"],
  ["derecho_porcentaje_uit", "Porcentaje de UIT"],
  ["plazo_texto", "Plazo"],
  ["silencio_administrativo", "Silencio administrativo"],
  ["autoridad_resuelve", "Autoridad que resuelve"],
] as const;

function mostrar(valor: unknown): string {
  return valor === null || valor === undefined || valor === "" ? "No especificado" : String(valor);
}

export function compararTramites(antes: TupaTramite[], despues: TupaTramite[]): TupaDifference[] {
  const mapaAntes = new Map(antes.map((tramite) => [tramite.codigo, tramite]));
  const mapaDespues = new Map(despues.map((tramite) => [tramite.codigo, tramite]));
  const diferencias: TupaDifference[] = [];

  for (const tramite of despues) {
    const original = mapaAntes.get(tramite.codigo);
    if (!original) {
      diferencias.push({
        tipo: "Nuevo",
        codigo: tramite.codigo,
        denominacion: tramite.denominacion,
        cambios: [],
      });
      continue;
    }

    const cambios: TupaDifference["cambios"] = campos.flatMap(([clave, etiqueta]) => {
      const valorAntes = original[clave];
      const valorDespues = tramite[clave];
      return String(valorAntes ?? "") === String(valorDespues ?? "")
        ? []
        : [{ campo: etiqueta, antes: mostrar(valorAntes), despues: mostrar(valorDespues) }];
    });
    const requisitosAntes = original.requisitos.map((requisito) => requisito.texto).join("\n");
    const requisitosDespues = tramite.requisitos.map((requisito) => requisito.texto).join("\n");
    if (requisitosAntes !== requisitosDespues) {
      cambios.push({
        campo: "Requisitos",
        antes: requisitosAntes || "No especificados",
        despues: requisitosDespues || "No especificados",
      });
    }
    if (cambios.length) {
      diferencias.push({
        tipo: "Modificado",
        codigo: tramite.codigo,
        denominacion: tramite.denominacion,
        cambios,
      });
    }
  }

  for (const tramite of antes) {
    if (!mapaDespues.has(tramite.codigo)) {
      diferencias.push({
        tipo: "Retirado",
        codigo: tramite.codigo,
        denominacion: tramite.denominacion,
        cambios: [],
      });
    }
  }
  return diferencias;
}
