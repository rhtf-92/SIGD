# SIGD RENATO — MATRIZ DE PRUEBAS DE SEGURIDAD Y REGRESIÓN R3
## TSK-R3 — Batería de Validación Funcional y de Seguridad Multirrol

**Proyecto:** Sistema Integral de Gestión Documentaria — SIGD RENATO.  
**Institución:** Instituto de Educación Superior Tecnológico Público «Suiza» — Pucallpa, Ucayali.  
**Rama exclusiva:** `B_JACOBO`.  
**Base de datos:** `sigd_jacobo_demo` (PostgreSQL 18.6).  
**Entorno de ejecución:** Vitest 3.2.7 (Backend) / Vitest 5.0.2 (Frontend) / Node.js 24.19.0.

---

## 1. TABLA MAESTRA DE LOS 14 ESCENARIOS OBLIGATORIOS (SECCIÓN 13)

| # | Escenario Evaluado | Archivo de Prueba | Mecanismo de Control | Resultado Esperado | Resultado Obtenido | Estado |
|:---:|---|---|---|:---:|:---:|:---:|
| **1** | `ADMINISTRADOR` intenta asignar evaluador | `backend/tests/unit/domains/rutadoc/r3-armonizacion-autorizacion.spec.ts` | Eliminación de bypass incondicional en `evaluadores.service.ts:74` | 403 Forbidden | `ForbiddenError: No cuenta con facultades` (HTTP 403) | **PASÓ** |
| **2** | `ADMINISTRADOR` intenta reasignar evaluador | `backend/tests/unit/domains/rutadoc/r3-armonizacion-autorizacion.spec.ts` | Verificación de permiso `EXPEDIENTE_REASIGNAR` en ámbito institucional | 403 Forbidden | `ForbiddenError: No cuenta con facultades` (HTTP 403) | **PASÓ** |
| **3** | Actor autorizado asigna dentro de su ámbito | `backend/tests/unit/domains/rutadoc/r3-armonizacion-autorizacion.spec.ts` | Validación de permiso `EXPEDIENTE_ASIGNAR` coincidente con `areaId` | Permitido | Retorna `ok: true`, genera `idAsignacion` y evento outbox | **PASÓ** |
| **4** | Actor autorizado intenta asignar fuera de su ámbito | `backend/tests/unit/domains/rutadoc/r3-armonizacion-autorizacion.spec.ts` | Validación de discrepancia entre `areaIdExpediente` y `areaId` del actor | 403 Forbidden | `ForbiddenError: No cuenta con facultades` (HTTP 403) | **PASÓ** |
| **5** | Usuario intenta consultar expediente ajeno | `backend/tests/unit/domains/rutadoc/r3-armonizacion-autorizacion.spec.ts` | Regla contextual `puedeVerExpediente` (titularidad vs funcionario) | 403 Forbidden | Validación evalúa `esTitular: false`, `permiso: false` -> Denegado | **PASÓ** |
| **6** | Permiso revocado en caliente | `backend/tests/unit/domains/rutadoc/r3-armonizacion-autorizacion.spec.ts` | Consulta atómica de vigencia y permisos en sesión/token | Denegación inmediata | Rechaza inmediatamente con `ForbiddenError` (HTTP 403) | **PASÓ** |
| **7** | `JEFE_UNIDAD_ACADEMICA` accede a función autorizada | `backend/tests/unit/domains/rutadoc/r3-armonizacion-autorizacion.spec.ts` | Permiso `EXPEDIENTE_ASIGNAR` en su unidad orgánica académica | Permitido | Retorna `ok: true`, genera asignación válida | **PASÓ** |
| **8** | `JEFE_UNIDAD_ACADEMICA` intenta función no autorizada | `backend/tests/unit/domains/rutadoc/r3-armonizacion-autorizacion.spec.ts` | Intento de reasignación fuera de su jurisdicción académica | 403 Forbidden | `ForbiddenError: No cuenta con facultades` (HTTP 403) | **PASÓ** |
| **9** | `TESORERO` accede a módulo financiero | `backend/tests/unit/domains/rutadoc/r3-armonizacion-autorizacion.spec.ts` | Permisos `TESORERIA_*` evaluados en guard financiero | Permitido | `tienePermisoFinanciero: true`, acceso habilitado a `/tesoreria` | **PASÓ** |
| **10** | `TESORERO` intenta acceder a bandeja general | `backend/tests/unit/domains/rutadoc/r3-armonizacion-autorizacion.spec.ts` | Segregación de responsabilidades: falta de `EXPEDIENTE_ASIGNAR` | 403 Forbidden | `ForbiddenError: No cuenta con facultades` (HTTP 403) | **PASÓ** |
| **11** | `ESPECIALISTA` intenta operar como rol activo | `backend/tests/unit/domains/rutadoc/r3-armonizacion-autorizacion.spec.ts` | Rol descontinuado (`vigente = false`, sin permisos válidos) | Denegado | `ForbiddenError: No cuenta con facultades` (HTTP 403) | **PASÓ** |
| **12** | `GESTOR_APOYO_AREA` intenta asignar evaluadores | `backend/tests/unit/domains/rutadoc/r3-armonizacion-autorizacion.spec.ts` | Rol de asistencia sin facultades resolutivas/asignativas | 403 Forbidden | `ForbiddenError: No cuenta con facultades` (HTTP 403) | **PASÓ** |
| **13** | Reasignación autorizada | `backend/tests/unit/domains/rutadoc/r3-armonizacion-autorizacion.spec.ts` | Transición de estado a `REASIGNADA` y enlace a historial previo | Historial anterior preservado | UPDATE a `REASIGNADA`, INSERT con `asignacion_anterior_id` | **PASÓ** |
| **14** | Reasignación sin motivo obligatorio | `backend/tests/unit/domains/rutadoc/r3-armonizacion-autorizacion.spec.ts` | Validación de justificación obligatoria (mínimo 10 caracteres) | Rechazada | `ValidationError: Longitud insuficiente` | **PASÓ** |

---

## 2. SUITES DE PRUEBAS COMPLEMENTARIAS EJECUTADAS Y CONSOLIDADAS

### 2.1 Backend — RutaDoc: Asignación de Evaluadores
- **Archivo:** `backend/tests/unit/domains/rutadoc/evaluadores-asignacion.spec.ts`
- **Total Pruebas:** 15 pruebas unitarias.
- **Pruebas añadidas en R3:**
  - `rechaza con 403 cuando ADMINISTRADOR intenta asignar evaluador` (PASÓ).
  - `rechaza con 403 cuando GESTOR_APOYO_AREA intenta asignar evaluadores` (PASÓ).
  - `rechaza con 403 cuando actor autorizado intenta asignar fuera de su ámbito territorial/área` (PASÓ).
  - `permite a JEFE_UNIDAD_ACADEMICA asignar evaluador dentro de su área autorizada` (PASÓ).
  - `rechaza con 403 cuando ADMINISTRADOR intenta reasignar evaluador` (PASÓ).
  - `rechaza con 403 cuando JEFE_UNIDAD_ACADEMICA intenta reasignar en un área fuera de su competencia` (PASÓ).
- **Resultado:** 15/15 passed (100%).

### 2.2 Backend — RutaDoc: Autorización Contextual de Evaluadores
- **Archivo:** `backend/tests/unit/domains/rutadoc/evaluadores-autorizacion-contextual.spec.ts`
- **Total Pruebas:** 16 pruebas unitarias.
- **Resultado:** 16/16 passed (100%).

### 2.3 Backend — RutaDoc: Autorización de Lectura de Expediente
- **Archivo:** `backend/tests/unit/domains/rutadoc/rbac-puede-ver-expediente.spec.ts`
- **Total Pruebas:** 14 pruebas unitarias.
- **Resultado:** 14/14 passed (100%).

### 2.4 Backend — OrganiCore: Capacidades Operativas (R1)
- **Archivo:** `backend/tests/unit/domains/organicore/capacidades-operativas.spec.ts`
- **Total Pruebas:** 6 pruebas unitarias.
- **Resultado:** 6/6 passed (100%).

### 2.5 Backend — Seguridad RBAC: Revocación Inmediata (TSK-1.0C)
- **Archivo:** `backend/tests/unit/rbac-revocacion-inmediata-tsk10c.spec.ts`
- **Total Pruebas:** 17 pruebas unitarias.
- **Resultado:** 17/17 passed (100%).

### 2.6 Backend — Seguridad RBAC: Matriz de Autorización Global
- **Archivo:** `backend/tests/unit/matriz-autorizacion-roles.spec.ts`
- **Total Pruebas:** 20 pruebas unitarias.
- **Resultado:** 20/20 passed (100%).

### 2.7 Backend — DocuCore: Despacho, Resoluciones y Validez Legal
- **Directorio:** `backend/tests/unit/domains/docucore/`
- **Total Pruebas:** 359 pruebas distribuidas en 19 archivos.
- **Resultado:** 359/359 passed (100%).

### 2.8 Frontend — Guards de Rutas y RBAC
- **Archivo:** `frontend/tests/unit/routes/rbacRoleGuardRoutes.test.tsx`
- **Total Pruebas:** 36 pruebas unitarias.
- **Cobertura R3:** Verifica denegación a `ESPECIALISTA` en todas las rutas operativas y acceso autorizado a `JEFE_UNIDAD_ACADEMICA` en proyector de resoluciones y bandeja de expedientes.
- **Resultado:** 36/36 passed (100%).

### 2.9 Frontend — Cabecera Institucional
- **Archivo:** `frontend/tests/unit/components/HeaderInstitucional.test.tsx`
- **Total Pruebas:** 14 pruebas unitarias.
- **Cobertura R3:** Verifica visibilidad de `JEFE_UNIDAD_ACADEMICA` (Resoluciones y Bandeja), redirección de `TESORERO` (exclusivo `/tesoreria`, sin botón Bandeja) y ausencia de botones operativos para `ESPECIALISTA`.
- **Resultado:** 14/14 passed (100%).

### 2.10 Frontend — Portada Institucional (HomePage)
- **Archivo:** `frontend/tests/unit/pages/HomePage.test.tsx`
- **Total Pruebas:** 10 pruebas unitarias.
- **Cobertura R3:** Verifica tarjetas institucionales para `JEFE_UNIDAD_ACADEMICA` y aislamiento para `TESORERO`.
- **Resultado:** 10/10 passed (100%).

### 2.11 Frontend — Inicio de Sesión y Enrutamiento Contextual
- **Archivo:** `frontend/tests/unit/pages/LoginPage.test.tsx`
- **Total Pruebas:** 16 pruebas unitarias.
- **Cobertura R3:** Verifica que `DESTINOS_POR_ROL` guíe a `TESORERO` hacia `/tesoreria` y que no exista asignación para `ESPECIALISTA`.
- **Resultado:** 16/16 passed (100%).

---

## 3. RESUMEN GLOBAL DE EJECUCIÓN

| Dominio | Pruebas Ejecutadas | Pruebas Aprobadas | Pruebas Fallidas | Estado |
|---|:---:|:---:|:---:|:---:|
| Backend — RutaDoc R3 | 45 | 45 | 0 | **100% OK** |
| Backend — OrganiCore & RBAC | 43 | 43 | 0 | **100% OK** |
| Backend — DocuCore | 359 | 359 | 0 | **100% OK** |
| Frontend — RBAC, Header, Portada, Login | 76 | 76 | 0 | **100% OK** |
| **TOTAL CONSOLIDADO** | **523** | **523** | **0** | **100% EXITOSO** |
