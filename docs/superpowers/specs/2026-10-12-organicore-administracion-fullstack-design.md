# OrganiCore y Administración Fullstack — Diseño

**Fecha:** 2026-10-12  
**Responsable:** Leonardo (`@Leo`)  
**Rama objetivo:** `fix/leonardo-organicore-admin`

## 1. Objetivo

Hacer funcionales y persistentes la administración de usuarios, el organigrama, el calendario laboral y las tablas maestras del SIGD, usando las migraciones PostgreSQL vigentes como única fuente de verdad y conservando el diseño visual actual del frontend.

El cierre debe garantizar que estos endpoints respondan contra PostgreSQL real:

- `GET /api/v1/admin/usuarios`
- `GET /api/v1/admin/organigrama`
- `GET /api/v1/admin/calendario-laboral`
- `GET /api/v1/admin/tablas-maestras`

Las operaciones habilitadas en la interfaz deben mantenerse después de recargar la página.

## 2. Decisiones canónicas

1. La estructura orgánica canónica es `sigd_org.area`.
2. No se creará ni consultará `sigd_org.unidad_organica`.
3. No se crearán `sigd_org.sede` ni `sigd_org.puesto_laboral`.
4. La asignación institucional se modelará con `sigd_org.asignacion_personal`, enlazando `id_usuario`, `area_id` y `cargo_id`.
5. Los roles se modelarán con `sigd_org.usuario_rol` y `sigd_org.rol_sistema`.
6. Todos los identificadores de usuarios, áreas, cargos y roles serán UUID.
7. Los estados persistentes de cuenta serán `ACTIVO` e `INACTIVO`, derivados de `sigd_auth.cuenta_usuario.activo`. No se expondrá `BLOQUEADO` porque la migración canónica no contiene ese estado.
8. La pestaña frontend `Sedes` se reemplazará por `Cargos`, conservando el diseño de tres pestañas.
9. El calendario persistente comprende feriados y días no laborables de `sigd_org.calendario_laboral`. La jornada y los horarios permanecerán como referencia visual porque no existe una tabla canónica aprobada para persistirlos.

## 3. Administración de usuarios

### 3.1 Lectura

`GET /api/v1/admin/usuarios` devolverá un directorio paginado con este contrato:

```ts
interface UsuarioAdministrado {
  id: string;
  idPersona: string;
  nombre: string;
  documento: string;
  correo: string;
  area: { id: string; nombre: string } | null;
  cargo: { id: string; nombre: string } | null;
  rol: { id: string; nombre: string } | null;
  estado: "ACTIVO" | "INACTIVO";
  ultimoAcceso: string | null;
}
```

La consulta enlazará:

- `sigd_auth.cuenta_usuario.id_usuario = sigd_org.asignacion_personal.id_usuario`;
- `sigd_auth.cuenta_usuario.id_usuario = sigd_org.usuario_rol.id_usuario`;
- `sigd_auth.cuenta_usuario.id_persona = sigd_auth.persona.id_persona`;
- `sigd_auth.persona.id_persona = sigd_auth.persona_natural.id_persona`;
- `asignacion_personal.area_id = area.area_id`;
- `asignacion_personal.cargo_id = cargo.cargo_id`;
- `usuario_rol.rol_id = rol_sistema.rol_id`.

Solo se considerarán asignaciones y roles cuya ventana de vigencia incluya el momento actual. Los filtros admitidos serán `busqueda`, `areaId`, `rolId`, `estado`, `pagina` y `limite`.

### 3.2 Actualización

`PUT /api/v1/admin/usuarios/:id` aceptará cambios parciales de:

- correo institucional;
- nombres y apellidos;
- `areaId`;
- `cargoId`;
- `rolId`;
- estado `ACTIVO` o `INACTIVO`.

La operación se ejecutará en una transacción. El cambio de área/cargo cerrará la asignación vigente y creará la nueva cuando corresponda. El cambio de rol cerrará el rol vigente y creará la nueva relación. Al inactivar una cuenta se marcará `activo=false` y se revocarán las sesiones activas mediante `revocado_en=now()`.

La API devolverá el usuario actualizado usando el mismo contrato de lectura. Conflictos de correo o usuario se mapearán a HTTP 409 mediante el middleware de errores existente.

El endpoint `POST /api/v1/admin/usuarios` no forma parte del flujo visible actual y no se ampliará en esta entrega. No debe interferir con los endpoints de lectura y actualización.

## 4. Organigrama

### 4.1 Contratos HTTP

- `GET /api/v1/admin/organigrama`: lista plana de áreas vigentes, ordenada por `path`.
- `GET /api/v1/admin/organigrama/arbol`: árbol anidado de áreas vigentes.
- `POST /api/v1/admin/organigrama/areas`: crea un área con `codigo`, `nombre` y `areaPadreId` opcional.
- `PUT /api/v1/admin/organigrama/areas/:id`: actualiza nombre o padre.
- `PATCH /api/v1/admin/organigrama/areas/:id/estado`: activa o inactiva mediante `vigente`.

El trigger `sigd_org.fn_area_set_path()` seguirá calculando `path` y `nivel`. La API no fabricará rutas jerárquicas en memoria.

Antes de reubicar un área se validará que el nuevo padre exista y que no sea la propia área ni un descendiente. Los errores de ciclo se expondrán como error de dominio `JERARQUIA_CICLO_INVALIDO`.

## 5. Tablas maestras

### 5.1 Catálogos administrables

La pantalla administrará exclusivamente:

- `areas` → `sigd_org.area`;
- `cargos` → `sigd_org.cargo`;
- `tipos-documentales` → `sigd_doc.tipo_documento`.

El parámetro de catálogo se resolverá mediante una lista cerrada. Nunca se interpolará directamente como nombre de tabla o columna SQL.

### 5.2 Contratos HTTP

- `GET /api/v1/admin/tablas-maestras?solo_activos=true|false`
- `POST /api/v1/admin/tablas-maestras/:catalogo`
- `PATCH /api/v1/admin/tablas-maestras/:catalogo/:id`
- `PATCH /api/v1/admin/tablas-maestras/:catalogo/:id/estado`

Cada elemento expondrá `id`, `codigo`, `nombre`, `detalle` y `estado`. En tipos documentales, `detalle` será descriptivo a partir de extensión, MIME y requisitos de firma; la creación utilizará los valores canónicos por defecto cuando la UI no los solicite.

El borrado será siempre lógico mediante `vigente=false`. Los códigos se normalizarán a mayúsculas y los duplicados producirán HTTP 409. Toda mutación invalidará la caché de tablas maestras.

No se ocultarán errores de relación o columna inexistente. Los errores PostgreSQL se propagarán al middleware RFC 9457.

## 6. Calendario laboral

### 6.1 Lectura y filtros

`GET /api/v1/admin/calendario-laboral` aceptará:

- `anio`: entero de cuatro dígitos;
- `desde`: fecha ISO `YYYY-MM-DD`;
- `hasta`: fecha ISO `YYYY-MM-DD`;
- `estado`: `ACTIVO`, `INACTIVO` o `TODOS`.

`desde` no podrá ser posterior a `hasta`. Cuando se combine año con rango, todos los filtros se aplicarán conjuntamente. La consulta se construirá con parámetros posicionales válidos y no generará cláusulas incompletas.

### 6.2 Mutaciones

- `POST /api/v1/admin/calendario-laboral/feriado-excepcional`: crea un feriado.
- `PATCH /api/v1/admin/calendario-laboral/:id/estado`: activa o inactiva un registro.

La unicidad se mantendrá por `(fecha, unidad_territorial)`. El botón `Quitar` realizará borrado lógico. Alta, inactivación y reactivación invalidarán la caché del calendario.

## 7. Frontend

### 7.1 Estado servidor

Usuarios, organigrama, calendario y tablas maestras usarán TanStack Query para lectura, mutación e invalidación. No se conservarán arreglos estáticos como fuente de datos productiva ni se aplicarán mutaciones únicamente locales.

Cada pantalla deberá representar:

- carga inicial;
- resultado vacío;
- error recuperable;
- mutación en progreso;
- confirmación de guardado.

Un HTTP 500 conservará los datos previamente confirmados, mostrará el error y no será sustituido por fixtures o catálogos predeterminados.

### 7.2 Usuarios

La UI conservará la tabla, filtros y modal. El filtro `Sede` se retirará y los filtros de área y rol enviarán UUID. El modal cargará áreas, cargos y roles desde tablas maestras y enviará `areaId`, `cargoId`, `rolId`, correo y estado.

### 7.3 Tablas maestras y organigrama

Las pestañas serán `Áreas`, `Cargos` y `Tipos documentales`. Crear e inactivar llamarán a la API y refrescarán el catálogo. El organigrama se construirá con los datos reales de `sigd_org.area`; no habrá fallback silencioso.

### 7.4 Calendario

La lista de feriados se cargará desde API. Agregar y quitar esperarán confirmación del servidor antes de informar éxito. Los controles de jornada y horario permanecerán como referencia visual sin prometer persistencia.

## 8. Tratamiento de errores

- Validación Zod: HTTP 400 con `invalidParams`.
- Recurso inexistente: HTTP 404.
- Código/correo/fecha duplicados: HTTP 409.
- Regla de jerarquía o vigencia: HTTP 422.
- Error SQL o infraestructura: HTTP 500 sin respuesta ficticia.

Las páginas mostrarán el mensaje global y mapearán `invalidParams` al campo correspondiente cuando aplique.

## 9. Estrategia de pruebas

La implementación seguirá ciclos TDD y cubrirá:

1. SQL de usuarios alineado con nombres de columnas y UUID reales.
2. Paginación y filtros por búsqueda, área, rol y estado.
3. Actualización transaccional de cuenta, persona, asignación y rol.
4. Revocación de sesiones al inactivar.
5. Organigrama plano y jerárquico desde `sigd_org.area`.
6. Creación, reubicación, inactivación y prevención de ciclos.
7. Lectura y mutación de áreas, cargos y tipos documentales.
8. Duplicados con HTTP 409 y borrado lógico.
9. Calendario filtrado por año, rango y estado.
10. Alta e inactivación persistente de feriados.
11. Frontend sin fallback silencioso y con estados de carga, vacío, error y guardado.
12. Persistencia observada tras invalidar caché o recargar la pantalla.

La verificación final incluirá typecheck, suites unitarias de backend y frontend, pruebas de integración PostgreSQL disponibles y smoke tests HTTP de los cuatro endpoints de aceptación.

## 10. Fuera de alcance

- Crear tablas de sedes o puestos laborales.
- Crear `unidad_organica`.
- Persistir configuración de jornada u horarios sin una migración aprobada.
- Rediseñar visualmente las pantallas de administración.
- Introducir borrado físico.
- Implementar un alta completa de usuarios que no está expuesta por la UI actual.
