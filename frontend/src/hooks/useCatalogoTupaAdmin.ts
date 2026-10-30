import { useState } from "react";
import type { CatalogoTupa, CatalogoTupaInput } from "../types/catalogoTupa";
import { useCambiarEstadoCatalogoTupa, useCatalogoTupa, useCrearCatalogoTupa, useEditarCatalogoTupa } from "../services/catalogoTupaService";

const vacio: CatalogoTupaInput = { codigo: "", nombre: "", tipo_catalogo: "PROCEDIMIENTO_ADMINISTRATIVO", motivo: "" };

export function useCatalogoTupaAdmin() {
  const consulta = useCatalogoTupa();
  const crear = useCrearCatalogoTupa();
  const editar = useEditarCatalogoTupa();
  const cambiarEstado = useCambiarEstadoCatalogoTupa();
  const [formulario, setFormulario] = useState<CatalogoTupaInput>(vacio);
  const [edicion, setEdicion] = useState<CatalogoTupa | null>(null);

  async function guardar() {
    if (edicion) await editar.mutateAsync({ id: edicion.catalogo_id, input: { ...formulario, motivo: formulario.motivo } });
    else await crear.mutateAsync(formulario);
    setFormulario(vacio); setEdicion(null);
  }
  function editarConcepto(item: CatalogoTupa) {
    setEdicion(item); setFormulario({ codigo: item.codigo, nombre: item.nombre, tipo_catalogo: item.tipo_catalogo, rubro: item.rubro, sub_rubro: item.sub_rubro, dependencia: item.dependencia, autoridad: item.autoridad, motivo: "" });
  }
  return { catalogos: consulta.data ?? [], formulario, setFormulario, edicion, editarConcepto, cancelar: () => { setEdicion(null); setFormulario(vacio); }, guardar, alternar: (item: CatalogoTupa, motivo: string) => cambiarEstado.mutateAsync({ id: item.catalogo_id, vigente: !item.vigente, motivo }), cargando: consulta.isLoading, guardando: crear.isPending || editar.isPending || cambiarEstado.isPending, error: consulta.error };
}
