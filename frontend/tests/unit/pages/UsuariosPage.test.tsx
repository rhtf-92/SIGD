import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UsuariosPage from "@/pages/administracion/UsuariosPage";
import { ApiHttpError } from "@/types/api";
import { DEBOUNCE_BUSQUEDA_MS } from "@/types/usuarioAdmin";
import { listarUsuarios, actualizarUsuario } from "@/services/adminUsuariosService";
const get = vi.fn(), put = vi.fn(), post = vi.fn();
vi.mock("@/api/client",()=>({apiClient:{get:(...a:unknown[])=>get(...a),put:(...a:unknown[])=>put(...a),post:(...a:unknown[])=>post(...a)}}));
const U="10000000-0000-4000-8000-000000000001", U2="10000000-0000-4000-8000-000000000002";
const A="20000000-0000-4000-8000-000000000001", C="30000000-0000-4000-8000-000000000001";
const C2="30000000-0000-4000-8000-000000000002", R="40000000-0000-4000-8000-000000000001";
const S="50000000-0000-4000-8000-000000000001", UR="60000000-0000-4000-8000-000000000001";
const primero={id:U,nombre:"Persona Uno",nombres:"Persona",apellidos:"Uno",tipoPersona:"NATURAL",dni:"12345678",correo:"uno@iestpsuiza.edu.pe",
 sede:null,area:"Mesa de Partes",cargo:"Asistente",rol:"Especialista",estado:"ACTIVO",ultimoAcceso:null,
 asignaciones:[{id:S,cargoId:C,areaId:A,cargo:"Asistente",area:"Mesa de Partes"}],roles:[{id:UR,rolId:R,areaId:null as string | null,nombre:"Especialista"}]};
const segundo={...primero,id:U2,nombre:"Persona Dos",apellidos:"Dos",correo:"dos@iestpsuiza.edu.pe",estado:"INACTIVO",asignaciones:[],roles:[]};
const catalogos={areas:[{id:A,nombre:"Mesa de Partes"}],cargos:[{id:C,nombre:"Asistente"},{id:C2,nombre:"Jefe de Mesa de Partes"}],roles:[{id:R,nombre:"Especialista"}],tiposDocumento:[{id:"1",codigo:"DNI",nombre:"DNI"}]};
function respuesta(datos=[primero,segundo],pagina=1,total=2,limite=20){return{datos,paginacion:{pagina,limite,total,totalPaginas:Math.ceil(total/limite)},catalogos};}
function montar(){
 const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
 const vista=render(<MemoryRouter><QueryClientProvider client={client}><UsuariosPage/></QueryClientProvider></MemoryRouter>);
 return{...vista,client};
}
function problema(status:number,campo?:string){
 return new ApiHttpError({type:"about:blank",title:"Operación rechazada",status,detail:"No se pudo completar la solicitud.",
 instance:"/api/v1/admin/usuarios/"+U,code:"PRUEBA",category:"Security",correlationId:"correlacion-sintetica",
 invalidParams:campo?[{name:campo,reason:"Este correo ya está registrado."}]:[],retryable:false});
}
const filtros={busqueda:"",area:"",sede:"",rol:"",estado:"Todos" as const};
describe("Directorio UUID: formulario existente y API original",()=>{
 beforeEach(()=>{get.mockImplementation((url:string)=>({data:url===`/api/v1/admin/usuarios/${U}`?primero:respuesta()}));put.mockResolvedValue({data:primero});post.mockResolvedValue({data:primero});});
 afterEach(()=>{vi.useRealTimers();vi.clearAllMocks();});
 it("presenta datos y total de la respuesta paginada sin descartar UUID",async()=>{
  montar();expect(await screen.findByText("Persona Uno")).toBeInTheDocument();
  expect(screen.getByText("Persona Dos")).toBeInTheDocument();
  expect(screen.getByText(/Directorio institucional de 2 cuentas/)).toBeInTheDocument();
  expect(get).toHaveBeenCalledWith("/api/v1/admin/usuarios",expect.objectContaining({params:expect.objectContaining({pagina:1,limite:20})}));
 });
 it("abre el alta y envía la cuenta al endpoint administrativo real",async()=>{
  const user=userEvent.setup();montar();await screen.findByText("Persona Uno");
  await user.click(screen.getByRole("button",{name:/NUEVO USUARIO/i}));
  const dialog=await screen.findByRole("dialog");
  await user.selectOptions(within(dialog).getByLabelText("Tipo de documento"),"1");
  await user.type(within(dialog).getByLabelText("DNI / documento"),"87654321");
  await user.type(within(dialog).getByLabelText("Nombres"),"Persona Nueva");
  await user.type(within(dialog).getByLabelText("Apellido paterno"),"Prueba");
  await user.type(within(dialog).getByLabelText("Correo institucional"),"nueva@iestpsuiza.edu.pe");
  await user.type(within(dialog).getByLabelText("Nombre de usuario"),"persona_nueva");
  await user.type(within(dialog).getByLabelText("Contraseña temporal"),"Clave-Prueba-2026!");
  await user.selectOptions(within(dialog).getByLabelText("Unidad orgánica"),A);
  await user.selectOptions(within(dialog).getByLabelText("Cargo"),C);
    await user.click(within(dialog).getByRole("button",{name:"Crear usuario"}));
  await waitFor(()=>expect(post).toHaveBeenCalledWith("/api/v1/admin/usuarios",expect.objectContaining({
    tipoDocumentoId:1,numeroDocumento:"87654321",nombres:"Persona Nueva",apellidoPaterno:"Prueba",
    correo:"nueva@iestpsuiza.edu.pe",username:"persona_nueva",areaId:A,cargoId:C,
  })));
  expect(await screen.findByText("La cuenta Persona Uno fue registrada correctamente.")).toBeInTheDocument();
 });
 it("conserva UUID y nulls de los datos recuperados",async()=>{
  const r=await listarUsuarios(filtros);
  expect(r.datos[0].id).toBe(U);expect(r.datos[0].sede).toBe("");expect(r.datos[0].ultimoAcceso).toBe("");
  expect(r.datos[0].asignaciones[0].cargoId).toBe(C);
 });
 it("admite UUIDs deterministas de PostgreSQL (ej. semillas 00000000-0000-0000-0000-000000000001)",async()=>{
  const semillaId = "00000000-0000-0000-0000-000000000001";
  const cuentaSemilla = { ...primero, id: semillaId };
  get.mockResolvedValueOnce({ data: respuesta([cuentaSemilla], 1, 1) });
  const r = await listarUsuarios(filtros);
  expect(r.datos[0].id).toBe(semillaId);
 });
 it("envía estado en mayúsculas y los identificadores de filtros reales",async()=>{
  const user=userEvent.setup();montar();await screen.findByText("Persona Uno");
  await user.selectOptions(screen.getByLabelText("Unidad orgánica"),A);
  await user.selectOptions(screen.getByLabelText("Rol asignado"),R);
  await user.selectOptions(screen.getByLabelText("Estado"),"Inactivo");
  await waitFor(()=>expect(get.mock.calls.at(-1)?.[1].params).toMatchObject({areaId:A,rolId:R,estado:"INACTIVO",pagina:1}));
 });
 it("mantiene debounce de búsqueda",async()=>{
  montar();await screen.findByText("Persona Uno");vi.useFakeTimers();
  const antes=get.mock.calls.length;fireEvent.change(screen.getByLabelText("Buscar usuario"),{target:{value:"Persona"}});
  expect(get.mock.calls.length).toBe(antes);
  await act(async()=>{await vi.advanceTimersByTimeAsync(DEBOUNCE_BUSQUEDA_MS);});
  expect(get.mock.calls.at(-1)?.[1].params.busqueda).toBe("Persona");
 });
 it("navega páginas usando el total del backend y reinicia página al cambiar estado",async()=>{
  get.mockImplementation(async(_url,config)=>({data:respuesta(config.params.pagina===2?[segundo]:[primero],config.params.pagina,21)}));
  const user=userEvent.setup();montar();await screen.findByText("Persona Uno");
  await user.click(screen.getByRole("button",{name:"Siguiente"}));
  expect(await screen.findByText("Persona Dos")).toBeInTheDocument();
  expect(get.mock.calls.at(-1)?.[1].params.pagina).toBe(2);
  await user.selectOptions(screen.getByLabelText("Estado"),"Activo");
  await waitFor(()=>expect(get.mock.calls.at(-1)?.[1].params).toMatchObject({pagina:1,estado:"ACTIVO"}));
 });
 it("abre el modal de la cuenta seleccionada y protege el documento de identidad",async()=>{
  const user=userEvent.setup();montar();await screen.findByText("Persona Uno");
  await user.click(within(screen.getByText("Persona Uno").closest("tr")!).getByRole("button",{name:"Administrar"}));
  const modal=await screen.findByRole("dialog");
  expect(within(modal).getByLabelText("Documento de identidad")).toHaveValue("12345678");
  expect(within(modal).getByLabelText("Documento de identidad")).toHaveAttribute("readonly");
  expect(within(modal).getByLabelText("Cargo")).toHaveValue(C);
 });
 it("envía cargo y área UUID al PUT correcto y confirma sólo una respuesta válida",async()=>{
  const user=userEvent.setup();montar();await screen.findByText("Persona Uno");
  await user.click(within(screen.getByText("Persona Uno").closest("tr")!).getByRole("button",{name:"Administrar"}));
  const modal=await screen.findByRole("dialog");await user.selectOptions(within(modal).getByLabelText("Cargo"),C2);
  await user.click(within(modal).getByRole("button",{name:"Guardar cambios"}));
  await waitFor(()=>expect(put).toHaveBeenCalledWith("/api/v1/admin/usuarios/"+U,{cargoId:C2,areaId:A,asignacionId:S}));
  expect(await screen.findByText("Los cambios fueron registrados correctamente.")).toBeInTheDocument();
 });
 it("conmuta Activo/Inactivo usando UUID, sin inventar Bloqueado",async()=>{
  put.mockResolvedValueOnce({data:{...primero,estado:"INACTIVO"}});
  const user=userEvent.setup();montar();await screen.findByText("Persona Uno");
  await user.click(within(screen.getByText("Persona Uno").closest("tr")!).getByRole("button",{name:"Conmutar estado"}));
  await waitFor(()=>expect(put).toHaveBeenCalledWith("/api/v1/admin/usuarios/"+U,{estado:"INACTIVO"}));
 });
 it("muestra el conflicto de correo sin anunciar persistencia ni cerrar el formulario",async()=>{
  put.mockRejectedValueOnce(problema(409,"correo"));const user=userEvent.setup();montar();await screen.findByText("Persona Uno");
  await user.click(within(screen.getByText("Persona Uno").closest("tr")!).getByRole("button",{name:"Administrar"}));
  const modal=await screen.findByRole("dialog"),correo=within(modal).getByLabelText("Correo institucional");
  await user.clear(correo);await user.type(correo,"otro@iestpsuiza.edu.pe");
  await user.click(within(modal).getByRole("button",{name:"Guardar cambios"}));
  expect(await within(modal).findByText("Este correo ya está registrado.")).toBeInTheDocument();
  expect(correo).toHaveAttribute("aria-invalid","true");
  expect(screen.queryByText("Los cambios fueron registrados correctamente.")).not.toBeInTheDocument();
 });
 it("rechaza correo externo modificado sin llamar a la API",async()=>{
  const user=userEvent.setup();montar();await screen.findByText("Persona Uno");
  await user.click(within(screen.getByText("Persona Uno").closest("tr")!).getByRole("button",{name:"Administrar"}));
  const modal=await screen.findByRole("dialog"),correo=within(modal).getByLabelText("Correo institucional");
  await user.clear(correo);await user.type(correo,"externo@gmail.com");
  await user.click(within(modal).getByRole("button",{name:"Guardar cambios"}));
  expect(await within(modal).findByText("El correo debe pertenecer al dominio @iestpsuiza.edu.pe.")).toBeInTheDocument();
  expect(put).not.toHaveBeenCalled();
 });
 it("no confunde una respuesta incompatible con un directorio vacío",async()=>{
  get.mockResolvedValue({data:{usuarios:[{id:1,nombre:"Incompatible"}]}});montar();
  expect(await screen.findByRole("alert")).toHaveTextContent("No fue posible consultar");
  expect(screen.queryByText("No se registran usuarios institucionales")).not.toBeInTheDocument();
 });
 it.each([[401,"La sesión no es válida o ha vencido"],[403,"no tiene el permiso institucional"],[500,"No fue posible consultar"]] as const)("presenta un error HTTP %i sin datos simulados",async (status,mensaje)=>{
  get.mockRejectedValue(problema(status));montar();
  expect(await screen.findByRole("alert",{}, {timeout:3000})).toHaveTextContent(mensaje);
  expect(screen.queryByText("Persona Uno")).not.toBeInTheDocument();
  expect(screen.queryByText(/0 resultados?/)).not.toBeInTheDocument();
 });
 it("conserva una lista vacía legítima",async()=>{
  get.mockResolvedValue({data:respuesta([],1,0)});montar();
  expect(await screen.findByText("No se registran usuarios institucionales")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
 });
 it("rechaza la respuesta de otra cuenta tras una edición",async()=>{
  put.mockResolvedValueOnce({data:segundo});
  await expect(actualizarUsuario(U,{correo:"otro@iestpsuiza.edu.pe"})).rejects.toMatchObject({status:502});
 });
 it("conserva todas las asignaciones y roles si sólo se modifica el correo",async()=>{
  const multiple={...primero,asignaciones:[...primero.asignaciones,{...primero.asignaciones[0],id:U2,cargoId:C2,cargo:'Jefe de Mesa de Partes'}],
    roles:[...primero.roles,{...primero.roles[0],id:U2,areaId:A}]};
  get.mockImplementation((url:string)=>({data:url===`/api/v1/admin/usuarios/${U}`?multiple:respuesta([multiple])}));
  const user=userEvent.setup();montar();await screen.findByText('Persona Uno');
  await user.click(within(screen.getByText('Persona Uno').closest('tr')!).getByRole('button',{name:'Administrar'}));
  const modal=await screen.findByRole('dialog');
  expect(within(modal).getByLabelText('Cargo')).toBeDisabled();
  expect(within(modal).getByText('ROLES ASIGNADOS AL USUARIO')).toBeInTheDocument();
  const correo=within(modal).getByLabelText('Correo institucional');await user.clear(correo);await user.type(correo,'nuevo@iestpsuiza.edu.pe');
  await user.click(within(modal).getByRole('button',{name:'Guardar cambios'}));
  await waitFor(()=>expect(put).toHaveBeenCalledWith('/api/v1/admin/usuarios/'+U,{correo:'nuevo@iestpsuiza.edu.pe'}));
 });
});
