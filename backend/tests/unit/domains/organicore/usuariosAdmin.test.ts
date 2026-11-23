import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { crearUsuariosAdminService, type UsuarioDirectorio } from '../../../../src/domains/organicore/usuariosAdmin.service.js';
import { correoInstitucionalSchema, listarUsuariosQuerySchema, crearUsuarioAdminSchema,
  actualizarUsuarioAdminSchema, usuarioIdParamSchema } from '../../../../src/domains/organicore/dto/usuarioAdmin.dto.js';
import { Argon2Service } from '../../../../src/domains/identicore/argon2.service.js';
const U='10000000-0000-4000-8000-000000000001', P='20000000-0000-4000-8000-000000000001';
const A='30000000-0000-4000-8000-000000000001', C='40000000-0000-4000-8000-000000000001';
const R='50000000-0000-4000-8000-000000000001', S='60000000-0000-4000-8000-000000000001';
const UR='70000000-0000-4000-8000-000000000001', OTRO='80000000-0000-4000-8000-000000000001', ADMIN_ID='90000000-0000-4000-8000-000000000001';
const usuario: UsuarioDirectorio={id:U,nombre:'Persona Sintética',nombres:'Persona',apellidos:'Sintética',tipoPersona:'NATURAL',
 dni:'12345678',correo:'sintetico@iestpsuiza.edu.pe',sede:null,area:'Área prueba',cargo:'Cargo prueba',rol:'Rol prueba',
 estado:'ACTIVO',ultimoAcceso:null,asignaciones:[{id:S,areaId:A,cargoId:C,area:'Área prueba',cargo:'Cargo prueba'}],
 roles:[{id:UR,rolId:R,areaId:A,nombre:'Rol prueba'}]};
const catalogos={areas:[{id:A,nombre:'Área prueba'}],cargos:[{id:C,nombre:'Cargo prueba'}],roles:[{id:R,nombre:'Rol prueba'}],tiposDocumento:[{id:'1',codigo:'DNI',nombre:'DNI'}]};
const alta={tipoDocumentoId:1,numeroDocumento:'12345678',nombres:'Persona',apellidoPaterno:'Sintética',apellidoMaterno:'Ejemplo',
  correo:usuario.correo,username:'cuenta_sintetica',passwordInicial:'Solo-Pruebas-Unitarias-2026!',cargoId:C,areaId:A,rolId:R,estado:'ACTIVO' as const};

describe('DTO originales alineados con el modelo UUID',()=>{
 it.each(['persona@iestpsuiza.edu.pe',' PERSONA@IESTPSUIZA.EDU.PE ','admin@iestp-suiza.edu.pe',' ADMIN@IESTP-SUIZA.EDU.PE ','persona@gmail.com','persona@hotmail.com','usuario@yahoo.com','admin@outlook.com'])('acepta correo institucional y personal %s',v=>expect(correoInstitucionalSchema.safeParse(v).success).toBe(true));
 it.each(['sin-correo','invalido@','@dominio.com','espacios en@correo.com'])('rechaza correo inválido %s',v=>expect(correoInstitucionalSchema.safeParse(v).success).toBe(false));
 it('aplica página y límite por defecto',()=>expect(listarUsuariosQuerySchema.parse({})).toEqual({pagina:1,limite:20}));
 it('valida filtros y convierte paginación',()=>expect(listarUsuariosQuerySchema.parse({pagina:'2',limite:'10',areaId:A,rolId:R,estado:'INACTIVO'})).toMatchObject({pagina:2,limite:10,areaId:A,rolId:R}));
 it.each([{pagina:0},{limite:101},{areaId:'3'},{estado:'INVENTADO'}])('rechaza filtros inválidos %j',v=>expect(listarUsuariosQuerySchema.safeParse(v).success).toBe(false));
 it('conserva el UUID en el parámetro de ruta',()=>expect(usuarioIdParamSchema.parse({id:U})).toEqual({id:U}));
 it.each(['1','0','-5','abc'])('rechaza un identificador que no es UUID: %s',id=>expect(usuarioIdParamSchema.safeParse({id}).success).toBe(false));
 it('acepta alta por cargo y área reales',()=>expect(crearUsuarioAdminSchema.parse(alta)).toMatchObject({cargoId:C,areaId:A,rolId:R}));
 it('valida el límite real de apellidos antes de escribir',()=>expect(crearUsuarioAdminSchema.safeParse({...alta,apellidoPaterno:'A'.repeat(80),apellidoMaterno:'B'.repeat(80)}).success).toBe(false));
 it.each([{cargoId:undefined},{rolId:'1'},{correo:'sin-correo'},{passwordInicial:'corta'},{numeroDocumento:'123'}])('valida el alta %j',d=>expect(crearUsuarioAdminSchema.safeParse({...alta,...d}).success).toBe(false));
 it('acepta edición parcial de campos originales',()=>expect(actualizarUsuarioAdminSchema.parse({nombres:'Persona',apellidos:'Prueba',cargoId:C,areaId:A,asignacionId:S})).toHaveProperty('asignacionId',S));
 it.each([{}, {correo:'sin-correo'}, {nombres:'A'}, {cargo:'Texto que el backend no persiste'}])('rechaza cambios vacíos, inválidos o desconocidos %j',v=>expect(actualizarUsuarioAdminSchema.safeParse(v).success).toBe(false));
});

describe('Directorio: consultas de lectura y resultados reales',()=>{
 let query: ReturnType<typeof vi.fn>;
 beforeEach(()=>{query=vi.fn(async(sql:string)=>{
   if(sql.includes('AS catalogos'))return{rows:[{catalogos}]};
   if(sql.includes('COUNT(*)::int AS total'))return{rows:[{total:41}]};
   return{rows:[usuario]};
 });});
 function servicio(){return crearUsuariosAdminService({query} as unknown as Pool);}
 it('devuelve datos, paginación y catálogos UUID',async()=>{
  expect(await servicio().listarUsuarios({pagina:2,limite:20})).toEqual({datos:[usuario],paginacion:{pagina:2,limite:20,total:41,totalPaginas:3},catalogos});
  expect(query.mock.calls[0][1]).toEqual([20,20]);expect(query.mock.calls[1][1]).toEqual([]);
 });
 it('usa las relaciones originales sin casts UUID/BIGINT ni tablas alternativas',async()=>{
  await servicio().listarUsuarios({pagina:1,limite:20});
  const sql=query.mock.calls[0][0];
  for(const t of ['cu.id_usuario','p.id_persona = cu.id_persona','pn.nombre_completo','ap.id_usuario = cu.id_usuario','ur.id_usuario = cu.id_usuario','ap.cargo_id','ap.area_id','cu.id_usuario ASC'])expect(sql).toContain(t);
  expect(sql).not.toMatch(/puesto_laboral|email_login|bloqueado_hasta|cu\.id\b/);
  expect(sql).toContain('LEFT JOIN LATERAL');expect(sql).toContain('jsonb_agg');
 });
 it('comparte búsqueda, área, rol y estado entre datos y conteo antes de paginar',async()=>{
  await servicio().listarUsuarios({busqueda:' Persona ',areaId:A,rolId:R,estado:'ACTIVO',pagina:3,limite:1});
  expect(query.mock.calls[0][1]).toEqual(['Persona',A,R,true,1,2]);
  expect(query.mock.calls[1][1]).toEqual(['Persona',A,R,true]);
  for(const n of [0,1])for(const c of ['websearch_to_tsquery','EXISTS','ap.area_id=$2::uuid','ur.rol_id=$3::uuid','cu.activo = $4','vigente_desde <= now()'])expect(query.mock.calls[n][0]).toContain(c);
 });
 it('conserva la lista vacía sin inventar usuarios',async()=>{
  query.mockImplementation(async(sql:string)=>sql.includes('AS catalogos')?{rows:[{catalogos}]}:sql.includes('COUNT(*)')?{rows:[{total:0}]}:{rows:[]});
  expect(await servicio().listarUsuarios({pagina:1,limite:20})).toMatchObject({datos:[],paginacion:{total:0,totalPaginas:0}});
 });
 it.each([{sedeId:A},{estado:'BLOQUEADO' as const}])('rechaza un filtro sin representación en el modelo %j',async f=>{
  await expect(servicio().listarUsuarios({...f,pagina:1,limite:20})).rejects.toMatchObject({status:422});
  expect(query).not.toHaveBeenCalled();
 });
 it('propaga errores SQL sin convertirlos en directorios vacíos',async()=>{
  query.mockRejectedValueOnce(new Error('SQL sintético'));await expect(servicio().listarUsuarios({pagina:1,limite:20})).rejects.toThrow('SQL sintético');
 });
});

function transaccion(opciones:{falla?:string; error?:unknown; existe?:boolean; asignaciones?:unknown[]; roles?:unknown[]; catalogoInvalido?:boolean; rolCodigo?:string}={}){
 const query=vi.fn(async(sql:string,params?:unknown[])=>{
  if(opciones.falla&&sql.includes(opciones.falla))throw opciones.error??new Error('Fallo sintético');
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))return{rows:[],rowCount:0};
  if(sql.includes('FROM sigd_auth.cuenta_usuario WHERE id_usuario=$1::uuid FOR UPDATE'))return{rows:opciones.existe===false?[]:[{id_persona:P,activo:true}],rowCount:opciones.existe===false?0:1};
  if(sql.startsWith('SELECT cargo_id')||sql.startsWith('SELECT area_id')||sql.startsWith('SELECT ap.area_id'))return{rows:opciones.catalogoInvalido?[]:[{}],rowCount:1};
  if(sql.startsWith('SELECT rol_id'))return{rows:opciones.catalogoInvalido?[]:[{rol_id:R,codigo:opciones.rolCodigo??'ESPECIALISTA'}],rowCount:1};
  if(sql.startsWith('SELECT codigo FROM sigd_auth.tipos_documento'))return{rows:[{codigo:'DNI'}],rowCount:1};
  if(sql.startsWith('INSERT INTO sigd_auth.persona('))return{rows:[{id_persona:P}],rowCount:1};
  if(sql.startsWith('INSERT INTO sigd_auth.cuenta_usuario'))return{rows:[{id_usuario:U}],rowCount:1};
  if(sql.startsWith('SELECT ap.id_asignacion'))return{rows:opciones.asignaciones??[{id_asignacion:S,cargo_id:C,area_id:A}],rowCount:1};
  if(sql.startsWith('SELECT ur.id_usuario_rol'))return{rows:opciones.roles??[{id_usuario_rol:UR,rol_id:R,area_id:A}],rowCount:1};
  if(sql.startsWith('SELECT cu.id_usuario::text'))return{rows:[usuario],rowCount:1};
  if(sql.startsWith('INSERT INTO sigd_audit.bitacora_auditoria'))return{rows:[{id_auditoria:'90000000-0000-4000-8000-000000000001'}],rowCount:1};
  if(/^(INSERT|UPDATE) /.test(sql))return{rows:[],rowCount:1};
  throw new Error('Consulta inesperada en la prueba');
 });
 const release=vi.fn(), connect=vi.fn(async()=>({query,release}));
 return{service:crearUsuariosAdminService({connect} as unknown as Pool),query,connect,release};
}

describe('Altas y ediciones transaccionales (PostgreSQL simulado, sin conexiones externas)',()=>{
 it('crea persona, cuenta UUID, asignación y rol con Argon2Service',async()=>{
  const hash=vi.spyOn(Argon2Service,'hash').mockResolvedValueOnce('$argon2id$solo-prueba');
  const p=transaccion();expect(await p.service.crearUsuario(alta)).toEqual(usuario);
  expect(hash).toHaveBeenCalledWith(alta.passwordInicial);
  expect(p.query.mock.calls.filter(([sql])=>sql.startsWith('INSERT INTO')).map(([sql])=>sql.split('(')[0].trim())).toEqual([
   'INSERT INTO sigd_auth.persona','INSERT INTO sigd_auth.persona_natural','INSERT INTO sigd_auth.persona_documento_historial',
   'INSERT INTO sigd_auth.cuenta_usuario','INSERT INTO sigd_org.asignacion_personal','INSERT INTO sigd_auth.usuario_institucion','INSERT INTO sigd_audit.bitacora_auditoria']);
  expect(p.query.mock.calls.at(-1)?.[0]).toBe('COMMIT');expect(p.release).toHaveBeenCalledOnce();hash.mockRestore();
 });
 it('no confirma una edición hasta recuperar su DTO dentro de la transacción',async()=>{
  const p=transaccion();await p.service.actualizarUsuario(U,{correo:'nuevo@iestpsuiza.edu.pe'});
  expect(p.query.mock.calls[1]).toEqual([expect.stringContaining('WHERE id_usuario=$1::uuid FOR UPDATE'),[U]]);
  const sqls=p.query.mock.calls.map(([sql])=>sql);
  expect(sqls.some(sql=>sql.includes('SELECT cu.id_usuario::text'))).toBe(true);
  expect(sqls.at(-2)).toContain('INSERT INTO sigd_audit.bitacora_auditoria');expect(sqls.at(-1)).toBe('COMMIT');
 });
 it.each(['INSERT INTO sigd_auth.persona_natural','INSERT INTO sigd_auth.cuenta_usuario','INSERT INTO sigd_org.asignacion_personal','SELECT cu.id_usuario::text'])('revierte todo el alta si falla %s',async falla=>{
  const p=transaccion({falla});await expect(p.service.crearUsuario(alta)).rejects.toThrow('Fallo sintético');
  expect(p.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');expect(p.query.mock.calls.map(([sql])=>sql)).not.toContain('COMMIT');expect(p.release).toHaveBeenCalledOnce();
 });
 it('traduce duplicidad de correo a conflicto público sin exponer detalles SQL',async()=>{
  const p=transaccion({falla:'UPDATE sigd_auth.cuenta_usuario SET correo',error:{code:'23505',constraint:'cuenta_usuario_correo_key'}});
  await expect(p.service.actualizarUsuario(U,{correo:'duplicado@iestpsuiza.edu.pe'})).rejects.toMatchObject({status:409,invalidParams:[{name:'correo',reason:expect.any(String)}]});
  expect(p.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
 });
 it('rechaza cuenta inexistente y revierte',async()=>{
  const p=transaccion({existe:false});await expect(p.service.actualizarUsuario(U,{estado:'INACTIVO'})).rejects.toMatchObject({status:404});
  expect(p.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
 });
 it('desactiva la cuenta y revoca sesiones con id_usuario sin borrar el historial',async()=>{
  const p=transaccion();await p.service.actualizarUsuario(U,{estado:'INACTIVO'});
  expect(p.query).toHaveBeenCalledWith(expect.stringContaining('SET activo=$2'),[U,false]);
  expect(p.query).toHaveBeenCalledWith(expect.stringContaining('SET revocado_en = now()'),[U]);
  expect(p.query.mock.calls.map(([sql])=>sql).join(' ')).not.toContain('DELETE');
 });
 it('conserva nombres y apellidos estructurados al reconstruir el nombre completo',async()=>{
  const p=transaccion();await p.service.actualizarUsuario(U,{apellidos:'Apellido modificado'});
  expect(p.query).toHaveBeenCalledWith(expect.stringContaining('nombre_completo=concat_ws'),[P,null,'Apellido modificado']);
 });
 it('actualiza el teléfono en la misma relación de persona natural usada por el alta',async()=>{
  const p=transaccion();await p.service.actualizarUsuario(U,{telefono:'900000000'});
  expect(p.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE sigd_auth.persona_natural SET telefono'),[P,'900000000']);
 });
 it('versiona exclusivamente la asignación seleccionada conservando las demás',async()=>{
  const p=transaccion({asignaciones:[{id_asignacion:S,cargo_id:C,area_id:A},{id_asignacion:OTRO,cargo_id:OTRO,area_id:A}]});
  await p.service.actualizarUsuario(U,{asignacionId:S,cargoId:C,areaId:OTRO});
  expect(p.query).toHaveBeenCalledWith(expect.stringContaining('SET vigente_hasta=now() WHERE id_asignacion'),[S]);
  expect(p.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO sigd_org.asignacion_personal'),[U,C,OTRO]);
  expect(p.query.mock.calls.filter(([sql])=>sql.startsWith('UPDATE sigd_org.asignacion_personal'))).toHaveLength(1);
 });
 it('no duplica una asignación vigente sin cambios',async()=>{
  const p=transaccion();await p.service.actualizarUsuario(U,{asignacionId:S,cargoId:C,areaId:A});
  expect(p.query.mock.calls.some(([sql])=>sql.startsWith('INSERT INTO sigd_org.asignacion_personal'))).toBe(false);
 });
 it('preserva el ámbito del rol elegido y revoca las sesiones al cambiarlo',async()=>{
  const p=transaccion();await p.service.actualizarUsuario(U,{usuarioRolId:UR,rolId:OTRO});
  expect(p.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO sigd_org.usuario_rol'),[U,OTRO,A,expect.any(String)]);
  expect(p.query).toHaveBeenCalledWith(expect.stringContaining('SET revocado_en = now()'),[U]);
 });
 it.each([{asignacionId:OTRO,cargoId:C,areaId:A},{usuarioRolId:OTRO,rolId:R}])('rechaza identificadores de asignaciones ajenas %j',async d=>{
  const p=transaccion();await expect(p.service.actualizarUsuario(U,d)).rejects.toMatchObject({status:422});expect(p.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
 });
 it('no elige arbitrariamente entre varios roles',async()=>{
  const p=transaccion({roles:[{id_usuario_rol:UR,rol_id:R,area_id:A},{id_usuario_rol:OTRO,rol_id:OTRO,area_id:null}]});
  await expect(p.service.actualizarUsuario(U,{rolId:OTRO})).rejects.toMatchObject({status:422});
 });
 it('rechaza un catálogo no vigente antes de confirmar cambios',async()=>{
  const p=transaccion({catalogoInvalido:true});await expect(p.service.actualizarUsuario(U,{rolId:R})).rejects.toMatchObject({status:422});
  expect(p.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
 });
 it.each([{estado:'BLOQUEADO' as const},{puestoLaboralId:S},{cargoId:C},{apellidoPaterno:'Apellido'}])('rechaza cambios sin correspondencia segura %j sin abrir transacción',async d=>{
  const p=transaccion();await expect(p.service.actualizarUsuario(U,d)).rejects.toMatchObject({status:422});expect(p.connect).not.toHaveBeenCalled();
 });
  it.each(['CIUDADANO', 'ESTUDIANTE'])('impide asignar el rol externo %s a personal institucional', async rolExterno => {
    const p = transaccion({ rolCodigo: rolExterno });
    await expect(p.service.asignarRol(U, R, ADMIN_ID)).rejects.toMatchObject({
      status: 422,
      invalidParams: [{ name: 'rolId', reason: expect.stringContaining('no corresponde al personal interno') }],
    });
    expect(p.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
  });
});
