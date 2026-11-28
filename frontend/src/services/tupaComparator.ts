import type { TupaTramite } from "./tupaApi";

export type TupaDifferenceKind = "Nuevo" | "Retirado" | "Modificado";

export interface TupaDifference {
  tipo: TupaDifferenceKind;
  codigo: string;
  denominacion: string;
  cambios: { campo: string; antes: string; despues: string }[];
}

const campos = [
  ["denominacion", "Denominación"],
  ["rubro", "Rubro"],
  ["descripcion", "Descripción"],
  ["calificacion", "Calificación"],
  ["silencio_administrativo", "Silencio administrativo"],
  ["plazo_dias_habiles", "Días hábiles"],
  ["plazo_texto", "Plazo"],
  ["derecho_monto", "Derecho de tramitación"],
  ["derecho_porcentaje_uit", "Porcentaje de UIT"],
  ["derecho_texto", "Texto del derecho"],
  ["cuenta_pago", "Cuenta o lugar de pago"],
  ["unidad_recibe", "Unidad que recibe"],
  ["autoridad_resuelve", "Autoridad que resuelve"],
  ["base_legal", "Base legal"],
  ["recursos", "Recursos impugnatorios"],
  ["observaciones", "Observaciones"],
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
