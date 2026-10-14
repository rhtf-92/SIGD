# OrganiCore y Administración Fullstack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar usuarios, organigrama, calendario y tablas maestras funcionales y persistentes sobre las migraciones PostgreSQL canónicas, conservando el diseño actual del frontend.

**Architecture:** OrganiCore usará servicios transaccionales sobre `sigd_auth`, `sigd_org` y `sigd_doc`, con UUID de extremo a extremo y `sigd_org.area` como jerarquía única. El frontend usará TanStack Query como estado servidor y eliminará catálogos locales y fallbacks silenciosos.

**Tech Stack:** Node.js, TypeScript, Express 5, PostgreSQL 18, Zod, React 19, TanStack Query 5, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-12-organicore-administracion-fullstack-design.md`

## Global Constraints

- No crear ni consultar `sigd_org.unidad_organica`, `sigd_org.sede` o `sigd_org.puesto_laboral`.
- Usar UUID para usuarios, personas, áreas, cargos y roles.
- Usar exclusivamente `ACTIVO` e `INACTIVO` para cuentas.
- Conservar la estructura visual existente; sustituir `Sedes` por `Cargos`.
- Toda eliminación funcional será borrado lógico.
- No ocultar errores HTTP/SQL mediante fixtures o fallbacks.
- Preservar cambios preexistentes ajenos a este plan.

## Review Focus

- Usuario sin asignación o rol vigente debe aparecer con valores nulos, no desaparecer del directorio.
- Cambio simultáneo de área, cargo y rol debe ser atómico y no dejar ventanas solapadas.
- Código maestro duplicado debe devolver 409 y conservar el registro anterior.
- Reubicación de un área bajo un descendiente debe devolver `JERARQUIA_CICLO_INVALIDO`.
- Rango de calendario invertido debe devolver 400 y no ejecutar SQL.

---

### Task 1: Administración de usuarios sobre contratos UUID canónicos

**Files:**
- Modify: `backend/src/domains/organicore/dto/usuarioAdmin.dto.ts`
- Modify: `backend/src/domains/organicore/usuariosAdmin.service.ts`
- Modify: `backend/src/domains/organicore/usuariosAdmin.controller.ts`
- Modify: `backend/src/domains/organicore/usuariosAdmin.routes.ts`
- Test: `backend/tests/unit/domains/organicore/usuariosAdmin.test.ts`

**Interfaces:**
- Consumes: tablas `sigd_auth.cuenta_usuario`, `persona`, `persona_natural`, `sesion_usuario`, `sigd_org.asignacion_personal`, `usuario_rol`, `area`, `cargo`, `rol_sistema`.
- Produces: `UsuarioDirectorio` con UUID y métodos `listarUsuarios(filtros)` y `actualizarUsuario(id, cambios)`.

- [ ] **Step 1: Escribir pruebas fallidas de contratos SQL y respuesta**

Agregar casos que exijan `id_usuario`, `id_persona`, uniones por UUID, filtros `areaId/rolId/estado`, usuarios sin relaciones vigentes y respuesta paginada.

- [ ] **Step 2: Ejecutar las pruebas y verificar RED**

Run: `npm.cmd test -- --run tests/unit/domains/organicore/usuariosAdmin.test.ts`

Expected: FAIL porque el servicio todavía usa `cu.id`, `cu.persona_id`, `puesto_laboral` y columnas inexistentes.

- [ ] **Step 3: Implementar lectura canónica y DTO UUID**

Cambiar `usuarioIdParamSchema` a UUID; eliminar sede, puesto y bloqueado; implementar la consulta parametrizada y su conteo con los nombres canónicos.

- [ ] **Step 4: Escribir pruebas fallidas de actualización transaccional**

Agregar casos para correo, datos personales, área/cargo, rol, estado, revocación de sesiones y rollback.

- [ ] **Step 5: Implementar actualización transaccional**

Cerrar relaciones vigentes con `vigente_hasta=now()`, insertar las nuevas, actualizar cuenta/persona y devolver el usuario actualizado. Usar `revocado_en=now()` al inactivar.

- [ ] **Step 6: Ejecutar prueba objetivo y typecheck**

Run: `npm.cmd test -- --run tests/unit/domains/organicore/usuariosAdmin.test.ts && npm.cmd run typecheck`

Expected: PASS y exit 0.

- [ ] **Step 7: Commit**

Commit: `fix: align organicore users with canonical schema`

---

### Task 2: Organigrama canónico basado en sigd_org.area

**Files:**
- Modify: `backend/src/domains/organicore/organigrama.service.ts`
- Modify: `backend/src/domains/organicore/organigrama.controller.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/unit/domains/organicore/ltree.spec.ts`
- Test: `backend/tests/unit/app-routes.spec.ts`

**Interfaces:**
- Consumes: `sigd_org.area(area_id,codigo,nombre,area_padre_id,path,nivel,vigente)`.
- Produces: lista plana, árbol anidado, creación, actualización e inactivación de áreas.

- [ ] **Step 1: Escribir pruebas fallidas del contrato de área**

Exigir que el SQL no mencione `unidad_organica`, use alias compatibles con el frontend y ordene por `path`.

- [ ] **Step 2: Ejecutar las pruebas y verificar RED**

Run: `npm.cmd test -- --run tests/unit/domains/organicore/ltree.spec.ts tests/unit/app-routes.spec.ts`

Expected: FAIL por las consultas actuales a una tabla inexistente y por falta del endpoint de estado.

- [ ] **Step 3: Implementar servicio y controladores**

Definir `obtenerAreasPlanas`, `obtenerOrganigrama`, `crearArea`, `actualizarArea` y `cambiarEstado`. Validar padre, autorreferencia y descendencia antes de actualizar.

- [ ] **Step 4: Montar contratos HTTP diferenciados**

`/organigrama` devolverá lista plana, `/organigrama/arbol` devolverá árbol y `PATCH /organigrama/areas/:id/estado` realizará borrado lógico.

- [ ] **Step 5: Ejecutar pruebas y typecheck**

Run: `npm.cmd test -- --run tests/unit/domains/organicore/ltree.spec.ts tests/unit/app-routes.spec.ts && npm.cmd run typecheck`

Expected: PASS y exit 0.

- [ ] **Step 6: Commit**

Commit: `fix: use area as canonical organization tree`

---

### Task 3: Tablas maestras y calendario persistentes

**Files:**
- Modify: `backend/src/domains/organicore/tablasMaestras.service.ts`
- Modify: `backend/src/domains/organicore/calendario.service.ts`
- Modify: `backend/src/domains/organicore/adminMaestras.controller.ts`
- Modify: `backend/src/domains/organicore/adminMaestras.routes.ts`
- Test: `backend/tests/unit/domains/organicore/calendario.spec.ts`
- Create: `backend/tests/unit/domains/organicore/tablasMaestras.spec.ts`

**Interfaces:**
- Consumes: `area`, `cargo`, `tipo_documento`, `calendario_laboral`.
- Produces: CRUD lógico cerrado para `areas|cargos|tipos-documentales` y calendario filtrable por año/rango/estado.

- [ ] **Step 1: Escribir pruebas fallidas de tablas maestras**

Cubrir lectura de los tres catálogos, alta, actualización, cambio de estado, invalidación de caché, catálogo inválido y duplicado 23505→409.

- [ ] **Step 2: Ejecutar y verificar RED**

Run: `npm.cmd test -- --run tests/unit/domains/organicore/tablasMaestras.spec.ts`

Expected: FAIL porque solo existe lectura tolerante con columnas antiguas.

- [ ] **Step 3: Implementar repositorio cerrado de catálogos**

Crear definiciones por catálogo con SQL estático y métodos `listar`, `crear`, `actualizar`, `cambiarEstado`. Propagar errores SQL no esperados.

- [ ] **Step 4: Escribir pruebas fallidas de calendario**

Cubrir filtros por año, desde, hasta, estado, rango invertido, alta e inactivación persistente.

- [ ] **Step 5: Corregir calendario y montar rutas de mutación**

Usar parámetros posicionales válidos, validar filtros Zod y agregar `PATCH /calendario-laboral/:id/estado`.

- [ ] **Step 6: Ejecutar pruebas y typecheck**

Run: `npm.cmd test -- --run tests/unit/domains/organicore/calendario.spec.ts tests/unit/domains/organicore/tablasMaestras.spec.ts && npm.cmd run typecheck`

Expected: PASS y exit 0.

- [ ] **Step 7: Commit**

Commit: `feat: persist organicore master data and calendar`

---

### Task 4: Frontend de usuarios conectado al contrato UUID

**Files:**
- Modify: `frontend/src/types/usuarioAdmin.ts`
- Modify: `frontend/src/services/adminUsuariosService.ts`
- Modify: `frontend/src/hooks/useUsuariosAdmin.ts`
- Modify: `frontend/src/components/administracion/UserEditModal.tsx`
- Modify: `frontend/src/pages/administracion/UsuariosPage.tsx`
- Test: `frontend/tests/unit/pages/UsuariosPage.test.tsx`

**Interfaces:**
- Consumes: `UsuarioDirectorio` y catálogos `areas/cargos/roles_sistema`.
- Produces: filtros y mutaciones UUID, estados `Activo|Inactivo`, modal sin sede ni datos locales.

- [ ] **Step 1: Escribir pruebas fallidas del nuevo contrato**

Exigir UUID, ausencia de sede/bloqueado, carga de catálogos reales, payload `areaId/cargoId/rolId` y errores visibles.

- [ ] **Step 2: Ejecutar y verificar RED**

Run: `npm.cmd test -- --run tests/unit/pages/UsuariosPage.test.tsx`

Expected: FAIL porque los tipos actuales usan números, sede y catálogos constantes.

- [ ] **Step 3: Implementar tipos, servicio, hook y pantalla**

Adaptar filtros, normalización, modal y mutaciones. Eliminar fallbacks y constantes productivas.

- [ ] **Step 4: Ejecutar prueba, typecheck y lint del frontend**

Run: `npm.cmd test -- --run tests/unit/pages/UsuariosPage.test.tsx && npm.cmd run typecheck && npm.cmd run lint`

Expected: PASS y exit 0.

- [ ] **Step 5: Commit**

Commit: `fix: connect user administration to postgres api`

---

### Task 5: Frontend persistente de tablas maestras, organigrama y calendario

**Files:**
- Modify: `frontend/src/types/tablasMaestras.ts`
- Modify: `frontend/src/hooks/useTablasMaestras.ts`
- Modify: `frontend/src/pages/administracion/TablasMaestrasPage.tsx`
- Modify: `frontend/src/hooks/useCalendarioLaboral.ts`
- Modify: `frontend/src/pages/administracion/CalendarioLaboralPage.tsx`
- Test: `frontend/tests/unit/pages/AdministracionPage.test.tsx`
- Create: `frontend/tests/unit/pages/TablasMaestrasPage.test.tsx`
- Create: `frontend/tests/unit/pages/CalendarioLaboralPage.test.tsx`

**Interfaces:**
- Consumes: endpoints persistentes de Tasks 2 y 3.
- Produces: pantallas con carga, vacío, error, guardando y guardado, sin fixtures productivos.

- [ ] **Step 1: Escribir pruebas fallidas de tablas maestras y organigrama**

Exigir pestañas `Áreas/Cargos/Tipos documentales`, lectura API, creación, borrado lógico, errores y árbol PostgreSQL.

- [ ] **Step 2: Escribir pruebas fallidas de calendario**

Exigir lectura API, alta confirmada, quitar mediante PATCH y error sin mutación optimista falsa.

- [ ] **Step 3: Ejecutar y verificar RED**

Run: `npm.cmd test -- --run tests/unit/pages/TablasMaestrasPage.test.tsx tests/unit/pages/CalendarioLaboralPage.test.tsx`

Expected: FAIL porque los hooks actuales modifican arreglos locales y silencian errores.

- [ ] **Step 4: Implementar hooks y estados visuales**

Usar TanStack Query, invalidar las claves correspondientes y conservar la composición visual de las páginas.

- [ ] **Step 5: Ejecutar pruebas, typecheck y lint**

Run: `npm.cmd test -- --run tests/unit/pages/AdministracionPage.test.tsx tests/unit/pages/TablasMaestrasPage.test.tsx tests/unit/pages/CalendarioLaboralPage.test.tsx && npm.cmd run typecheck && npm.cmd run lint`

Expected: PASS y exit 0.

- [ ] **Step 6: Commit**

Commit: `feat: persist organicore administration ui`

---

### Task 6: Verificación integral y aceptación

**Files:**
- Modify as needed: pruebas de integración o contratos detectados durante verificación.
- Test: suites completas backend/frontend.

**Interfaces:**
- Consumes: todas las tareas anteriores.
- Produces: evidencia de compilación, pruebas y cuatro endpoints de aceptación.

- [ ] **Step 1: Ejecutar suite completa backend**

Run: `npm.cmd test`

Expected: todas las suites aplicables pasan; skips condicionados a PostgreSQL se reportan explícitamente.

- [ ] **Step 2: Ejecutar build backend**

Run: `npm.cmd run build`

Expected: exit 0.

- [ ] **Step 3: Ejecutar suite completa frontend**

Run: `npm.cmd test`

Expected: todas las suites pasan.

- [ ] **Step 4: Ejecutar build frontend**

Run: `npm.cmd run build`

Expected: exit 0.

- [ ] **Step 5: Ejecutar pruebas PostgreSQL/smoke disponibles**

Levantar la infraestructura local cuando Docker esté disponible, aplicar migraciones y consultar los cuatro endpoints de aceptación, verificando persistencia tras segunda lectura.

- [ ] **Step 6: Revisar diff y solicitar revisión independiente**

Comparar la rama contra su base, clasificar hallazgos y corregir los críticos/importantes con RED→GREEN.

- [ ] **Step 7: Commit final de ajustes de aceptación**

Commit: `test: certify organicore administration flows`
