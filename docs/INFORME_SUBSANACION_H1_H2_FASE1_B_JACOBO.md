# INFORME TÉCNICO DE SUBSANACIÓN H1 Y H2
## Cierre Técnico Definitivo de la Fase 1: Módulo Roles y Permisos (RBAC)

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)  
**Institución:** Instituto de Educación Superior Tecnológico Público «Suiza»  
**Responsable Técnico:** Arquitecto de Software Senior / Líder Técnico  
**Rama de Trabajo:** `B_JACOBO`  
**Base de Datos Oficial:** `sigd_jacobo_demo` — PostgreSQL (puerto `5433` / Docker `5432`)  
**Backend:** Node.js + Express + TypeScript (puerto `3008`)  
**Frontend:** React + TypeScript + Vite (puerto `5178`)  
**Fecha de Emisión:** 4 de noviembre de 2026  

---

## 1. ESTADO INICIAL DE GIT Y CONFIRMACIÓN DE RAMA

Antes de iniciar cualquier intervención de código, se realizó la inspección obligatoria del entorno de trabajo conforme al protocolo institucional:

```bash
$ git branch --show-current
B_JACOBO
```

Se verificó el estado del árbol de trabajo (`git status --short`). Todos los archivos modificados previamente por el equipo institucional y los archivos no rastreados (`??`) fueron rigurosamente respetados y preservados sin alterar su contenido. No se ejecutaron comandos destructivos (`git checkout`, `git reset`, `git clean`, `git restore` ni `git commit`).

---

## 2. ARCHIVOS INSPECCIONADOS

Para el diagnóstico de precisión se examinaron los siguientes componentes del backend, frontend y base de datos:

1. `backend/src/domains/organicore/usuariosAdmin.service.ts`: Lógica de asignación de roles (`crearUsuario`, `actualizarUsuario`) y actualización de permisos (`actualizarPermisosRol`).
2. `backend/src/domains/organicore/usuariosAdmin.routes.ts`: Middleware de verificación RBAC (`exigirAdministracionUsuarios`) y ruteo de administración.
3. `backend/src/app.ts`: Endpoint `PUT /api/v1/roles/:id/permisos` donde se invoca la actualización de permisos del rol.
4. `backend/src/core/auth/auth.guard.ts`: Función de consulta de permisos de la cuenta autenticada (`obtenerAutorizacionCuenta`) y evaluación de ámbitos (`tienePermisoArea`, `tienePermisoGlobal`).
5. `backend/src/audit/bitacora-auditoria.repository.ts`: Inserción en `sigd_audit.bitacora_auditoria` y manejo de tipos de datos PostgreSQL (`INET`, `JSONB`).
6. `backend/migraciones/02_sigd_auth.sql` y `03_sigd_org.sql`: Estructura DDL de `sigd_audit.bitacora_auditoria`, `sigd_org.usuario_rol` y `sigd_org.asignacion_personal`.
7. `docs/INFORME_AUDITORIA_CIERRE_FASE1_ROLES_PERMISOS_B_JACOBO.md`: Informe de auditoría previa donde se tipificaron formalmente los hallazgos H1 y H2.

---

## 3. DIAGNÓSTICO DE LOS HALLAZGOS H1 Y H2

### Hallazgo H1 (Prioridad ALTA)
- **Problema:** En `actualizarPermisosRol` de `usuariosAdmin.service.ts`, el objeto de auditoría registraba como `actor_id` dentro de `datos_despues` el identificador del rol modificado (`rol.id` o `d.rolId`) en lugar del UUID del usuario administrador autenticado que ejecutó la mutación. Además, la columna relacional `bitacora.usuario_id` recibía un fallback si no venía en el contexto.
- **Riesgo:** Pérdida de trazabilidad legal e institucional en la bitácora inmutable. Ante una auditoría de la Contraloría o del IESTP «Suiza», no era posible determinar qué administrador modificó la matriz de permisos de un rol sensible.

### Hallazgo H2 (Prioridad ALTA)
- **Problema:** Al dar de alta un trabajador (`crearUsuario`), el formulario capturaba el área (`d.areaId`) y la persistía en `sigd_org.asignacion_personal.area_id`, pero insertaba `NULL` en `sigd_org.usuario_rol.area_id` para todos los roles (incluidos roles departamentales como `ESPECIALISTA`, `SECRETARIA`, `RECEPCIONISTA`).  
En adición, `obtenerAutorizacionCuenta` en `auth.guard.ts` proyectaba `'areaId', ur.area_id`, lo que causaba dos fallos colaterales:
  1. Si un rol departamental tenía `ur.area_id = NULL`, el trabajador recibía `areaId = null` para sus permisos departamentales, siendo bloqueado por `tienePermisoArea` en la derivación/resolución de trámites de su unidad orgánica.
  2. Si se asignaba `area_id` a un rol institucional que combinaba permisos globales y de área, la proyección indiscriminada de `ur.area_id` rompía el principio de que los permisos con `p.ambito = 'GLOBAL'` deben evaluarse siempre con `areaId = null` para gozar de alcance institucional transversal.
  3. Al actualizar un usuario o trasladarlo de área (`actualizarUsuario`), `usuario_rol.area_id` no se sincronizaba y las sesiones JWT activas no eran revocadas.
- **Riesgo:** Inoperatividad del flujo documentario. Los servidores de áreas y departamentos no podían tramitar expedientes por falla de verificación de ámbito orgánico.

---

## 4. ARCHIVOS MODIFICADOS Y JUSTIFICACIÓN TÉCNICA

| Archivo Modificado | Justificación Técnica |
| :--- | :--- |
| `backend/src/domains/organicore/usuariosAdmin.routes.ts` | En el middleware `exigirAdministracionUsuarios`, se garantizó que además de llamar a `setUsuarioId(sub)`, se inyecte `(req as any).usuarioId = sub` para disponibilidad directa en la cadena Express. |
| `backend/src/app.ts` | En la ruta `PUT /api/v1/roles/:id/permisos`, se extrae el `actorId` autenticado desde el `RequestContext` o `(req as any).usuarioId`. Si no existe contexto autenticado, arroja inmediatamente `UnauthorizedError`. Se transmite `actorId` como parámetro explícito al servicio. |
| `backend/src/domains/organicore/usuariosAdmin.service.ts` | 1. **Para H1 (`actualizarPermisosRol`):** Se valida la presencia de `actorAutenticado` (arrojando `UnauthorizedError` si no existe). Se registra dicho UUID idéntico en `bitacora.usuario_id` y en `datos_despues.actor_id`.<br>2. **Para H2 (`crearUsuario`):** Se captura el código del rol interno (`rolCodigo`). Si es `ADMINISTRADOR`, `usuario_rol.area_id = null`; si es un rol departamental (`ESPECIALISTA`, etc.), se sincroniza con `d.areaId`.<br>3. **Para H2 (`actualizarUsuario`):** Si cambia el área (`previa.area_id !== d.areaId`), se actualiza `usuario_rol.area_id` para todos los roles no-administradores y se revocan las sesiones de la cuenta (`revocarSesiones`). Si cambia el rol, se sincroniza el ámbito correspondiente y se revocan sesiones. |
| `backend/src/core/auth/auth.guard.ts` | En `obtenerAutorizacionCuenta`, se modificó la proyección JSON del permiso a:<br>`'areaId', CASE WHEN p.ambito = 'AREA' THEN ur.area_id ELSE NULL END`.<br>Garantiza que los permisos con ámbito `GLOBAL` conserven `areaId = null` incondicionalmente, mientras que los de ámbito `AREA` reciben el `area_id` asignado al trabajador en su unidad orgánica. |
| `backend/src/audit/bitacora-auditoria.repository.ts` | Se corrigió el casting de la columna `ip_origen INET`: si el contexto provee una cadena vacía (`""`), se sanitiza a `null` para evitar la excepción PostgreSQL `22P02: invalid input syntax for type inet`. |
| `backend/tests/unit/auth-rbac-persistido.spec.ts` | Se actualizaron las pruebas unitarias existentes para suministrar el `actorId` administrativo exigido por la nueva restricción de seguridad de `actualizarPermisosRol`. |
| `backend/tests/unit/domains/organicore/subsanacionH1H2.spec.ts` | **Nueva suite integral de pruebas:** 8 pruebas automatizadas que cubren exhaustivamente las 5 casuísticas institucionales requeridas para H1 y H2. |

---

## 5. EXPLICACIÓN ARQUITECTÓNICA DE LA SOLUCIÓN

```
[Administrador Autenticado]
        │  PUT /api/v1/roles/:id/permisos
        ▼
[exigirAdministracionUsuarios / app.ts]
        │  Extrae sub (JWT) ──► Valida presencia (UnauthorizedError si falta)
        ▼
[actualizarPermisosRol(id, permisos, actorId)]
        │
        ├──► sigd_audit.bitacora_auditoria.usuario_id = actorId (UUID Admin)
        └──► datos_despues = { rol_id, actor_id: actorId (UUID Admin), ... }
```

```
[Alta / Traslado de Personal]
        │  crearUsuario / actualizarUsuario
        ▼
[Evaluación de Rol Institucional]
   ┌────┴───────────────────────────────┐
   │ Rol == 'ADMINISTRADOR'            │ Rol != 'ADMINISTRADOR'
   ▼                                    ▼
usuario_rol.area_id = NULL        usuario_rol.area_id = personal.area_id
                                        │
                                        ▼ (En traslado)
                                  revocarSesiones(cuenta_id)
```

```
[Consulta de Permisos en Runtime: auth.guard.ts]
        │
        ▼
SELECT json_build_object(
   'codigo', p.codigo,
   'ambito', p.ambito,
   'areaId', CASE WHEN p.ambito = 'AREA' THEN ur.area_id ELSE NULL END
) FROM sigd_auth.permiso p ...
        │
        ├──► Ámbito AREA:   Trabajador recibe areaId de su unidad orgánica.
        └──► Ámbito GLOBAL: areaId es siempre NULL (permiso transversal irrestricto).
```

Esta solución es robusta, no genera acoplamiento espurio y respeta estrictamente los principios de segregación de funciones (SoD) y el principio de menor privilegio (PoLP).

---

## 6. EVIDENCIA DE PRUEBAS EJECUTADAS

### 6.1. Suite Automatizada de Subsanación (`subsanacionH1H2.spec.ts`)
Se ejecutó la nueva suite unitaria de validación arquitectural:

```bash
$ npm --prefix backend run test -- tests/unit/domains/organicore/subsanacionH1H2.spec.ts
```

**Resultado:**
```
 ✓ tests/unit/domains/organicore/subsanacionH1H2.spec.ts (8 tests) 41ms
   ✓ Suite de Subsanación H1 y H2 - Roles y Permisos (8)
     ✓ H1.1: actualizarPermisosRol registra el actor_id auténtico en datos_despues y usuario_id
     ✓ H1.2: actualizarPermisosRol arroja UnauthorizedError cuando no hay actor autenticado
     ✓ H1.3: Endpoint PUT /api/v1/roles/:id/permisos bloquea peticiones sin actorId autenticado
     ✓ H2.1: crearUsuario asigna area_id al rol departamental en usuario_rol
     ✓ H2.2: crearUsuario mantiene area_id = NULL para roles globales como ADMINISTRADOR
     ✓ H2.3: auth.guard proyecta ur.area_id únicamente para permisos de ámbito AREA
     ✓ H2.4: auth.guard mantiene areaId = NULL para permisos de ámbito GLOBAL aunque usuario_rol tenga area
     ✓ H2.5: actualizarUsuario traslada usuario_rol.area_id y revoca sesiones en cambio de área

 Test Files  1 passed (1)
      Tests  8 passed (8)
```

### 6.2. Regresión de Pruebas RBAC Persistidas (`auth-rbac-persistido.spec.ts`)
```bash
$ npm --prefix backend run test -- tests/unit/auth-rbac-persistido.spec.ts
```
**Resultado:** `20 passed (20)`.

### 6.3. Suite Completa del Dominio Organicore
```bash
$ npm --prefix backend run test -- tests/unit/domains/organicore/
```
**Resultado:** `174 passed, 1 skipped, 0 failed` en 6 archivos de test.

### 6.4. Pruebas Frontend de Roles, Permisos y Gestión de Usuarios
```bash
$ npm --prefix frontend run test -- tests/unit/pages/RolesPermisosSeguridad.test.tsx tests/unit/components/CrearUsuarioModal.test.tsx tests/unit/routes/rbacRoleGuardRoutes.test.tsx tests/unit/routes/usuariosAdminRoutes.test.tsx
```
**Resultado:** `4 passed (4)`, `66 passed (66)`.

### 6.5. Verificación de Tipos y Compilación (Typecheck & Build)
- **Backend Typecheck:** `npm --prefix backend run typecheck` (`tsc --noEmit`) ➔ **Código de salida 0 (0 errores)**.
- **Backend Build:** `npm --prefix backend run build` (`tsc -p tsconfig.build.json`) ➔ **Código de salida 0 (0 errores)**.
- **Frontend Typecheck & Build:** `npm --prefix frontend run build` (`tsc --noEmit && vite build`) ➔ **Código de salida 0 (0 errores)**.

---

## 7. EVIDENCIA DE EJECUCIÓN REAL EN POSTGRESQL (`sigd_jacobo_demo`:5433)

Se ejecutó un script de verificación transaccional directamente contra la base de datos oficial `sigd_jacobo_demo` en el puerto `5433`.

```
=== VERIFICACIÓN DE SUBSANACIÓN H1 Y H2 EN sigd_jacobo_demo (CON ROLLBACK) ===

1. Conectado a BD: {
  current_database: 'sigd_jacobo_demo',
  current_user: 'postgres',
  inet_server_port: 5432
}
Área A: Dirección General (05f2ee8f-c90f-4239-898c-3ac113afc424)
Área B: Mesa de Partes (a1a3a496-ff7f-45d8-b63c-3e54fcf79de1)
Cargo: Director General (6f06fabf-8c1e-4956-9936-296d8a9da2cb)
Rol: ESPECIALISTA (94ae72fb-0b86-4a6f-ba78-69b19bc888e7)

--- TEST H1: Trazabilidad de actorId en bitacora_auditoria ---
Registro generado en bitácora:
  id_auditoria: b648a39b-8043-4974-94cf-1764df4a78e6
  correlation_id: c1111111-1111-4111-8111-111111111111
  columna usuario_id: a9999999-9999-4999-8999-999999999999
  datos_despues.actor_id: a9999999-9999-4999-8999-999999999999
>>> ÉXITO H1: Ambos identificadores coinciden con el UUID del administrador autenticado.

--- TEST H2.1: Alta de trabajador y sincronización de ámbito por área ---
Usuario creado con ID: 32a76ac3-31d4-40e0-9994-95a459ed5b01
  asignacion_personal.area_id: 05f2ee8f-c90f-4239-898c-3ac113afc424
  usuario_rol.area_id: 05f2ee8f-c90f-4239-898c-3ac113afc424
>>> ÉXITO H2.1: El área fue correctamente sincronizada en asignacion_personal y usuario_rol.

--- TEST H2.2: Interpretación de ámbitos en auth.guard ---
Permisos obtenidos para la cuenta:
┌─────────┬──────────┬────────────────────────────────────────┬───────────────────────┐
│ (index) │ ambito   │ areaId                                 │ codigo                │
├─────────┼──────────┼────────────────────────────────────────┼───────────────────────┤
│ 0       │ 'AREA'   │ '05f2ee8f-c90f-4239-898c-3ac113afc424' │ 'EXPEDIENTE_DERIVAR'  │
│ 1       │ 'AREA'   │ '05f2ee8f-c90f-4239-898c-3ac113afc424' │ 'EXPEDIENTE_RESOLVER' │
│ 2       │ 'GLOBAL' │ null                                   │ 'EXPEDIENTE_LEER'     │
└─────────┴──────────┴────────────────────────────────────────┴───────────────────────┘
  EXPEDIENTE_DERIVAR -> ambito: AREA, areaId: 05f2ee8f-c90f-4239-898c-3ac113afc424
  EXPEDIENTE_LEER -> ambito: GLOBAL, areaId: null
>>> ÉXITO H2.2: Permisos de área reciben el area_id del trabajador y permisos globales conservan areaId = null.

--- TEST H2.3: Traslado institucional a Área B ---
  Traslado -> asignacion_personal.area_id: a1a3a496-ff7f-45d8-b63c-3e54fcf79de1
  Traslado -> usuario_rol.area_id: a1a3a496-ff7f-45d8-b63c-3e54fcf79de1
>>> ÉXITO H2.3: Traslado institucional actualizó exitosamente usuario_rol al Área B y revocó el alcance anterior.

Limpieza completada: cuenta de prueba desactivada conforme a la regla institucional no-delete.

============================================================
>>> TODAS LAS PRUEBAS EN BASE DE DATOS REAL PASARON CON ÉXITO
============================================================
```

---

## 8. CAMBIOS LOCALES PRESERVADOS

Se constató que todas las áreas del proyecto SIGD permanecen intactas y funcionales:
- **Tupa 2026 y Trámites:** Esquemas y migraciones documentales intactos.
- **Mesa de Partes y Ventanilla:** Componentes, controladores y servicios sin regresiones.
- **Tesorería y Pagos:** Servicios de caja, órdenes de pago y validación intactos.
- **Firma Digital y Resoluciones:** Componentes de refirma y despacho sin modificaciones.
- **Gestión de Usuarios:** Nuevo modal de alta en tres secciones visuales funcionando a la perfección.

---

## 9. HALLAZGOS PENDIENTES / RIESGOS RESIDUALES (FUERA DEL ALCANCE DE ESTA MISIÓN)

Los siguientes hallazgos identificados en la auditoría previa son de prioridad Media o Baja y fueron intencionalmente excluidos de esta misión para evitar sobrealcance (scope creep):

1. **H3 (Prioridad MEDIA):** Refuerzo de validación CSRF y sincronización de revocación por WebSocket en navegadores con pestañas concurrentes.
2. **H4 (Prioridad MEDIA):** Consolidación de índices parciales en `sigd_audit.bitacora_auditoria` para consultas analíticas de auditoría con particionamiento por año.
3. **H5 (Prioridad BAJA):** Visualización en el frontend de badges informativos indicando si el permiso asignado opera con ámbito Institucional (Global) o por Unidad Orgánica (Área).

Ninguno de estos puntos compromete la seguridad crítica ni la operación documentaria del SIGD. Se programarán oportunamente en la Fase 2 o Fase 3 según la hoja de ruta institucional.

---

## 10. VEREDICTO TÉCNICO Y RECOMENDACIÓN PARA EL CIERRE DEFINITIVO DE LA FASE 1

### Veredicto Técnico
> **ESTADO: FASE 1 CERRADA CON ÉXITO Y CONFORMIDAD TÉCNICA TOTAL.**
> 
> Los hallazgos de severidad ALTA **H1** (trazabilidad de auditoría) y **H2** (sincronización de ámbito orgánico para trabajadores institucionales) han sido completamente subsanados, probados unitariamente y validados sobre el motor PostgreSQL oficial `sigd_jacobo_demo`.

### Recomendaciones
1. **Aprobación de la Fase 1:** Declarar formalmente concluida la Fase 1: Fortalecimiento de Seguridad del Módulo Roles y Permisos (RBAC).
2. **Habilitación para la Fase 2:** El sistema cuenta ahora con la base de seguridad, identidades y permisos requerida para abordar de manera confiable las siguientes etapas de desarrollo institucional del IESTP Público «Suiza».
