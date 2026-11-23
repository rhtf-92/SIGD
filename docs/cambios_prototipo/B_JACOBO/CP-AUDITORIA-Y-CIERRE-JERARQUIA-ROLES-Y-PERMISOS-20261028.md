# SIGD B_JACOBO — INFORME DE AUDITORÍA Y CIERRE DEFINITIVO DE LA JERARQUÍA DE ROLES Y PERMISOS INSTITUCIONALES

**Fecha de emisión:** 28 de octubre de 2026  
**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD) — IESTP Suiza 2026  
**Rama de trabajo:** `B_JACOBO`  
**HEAD de referencia:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`  
**Entorno de desarrollo/demostración:** `sigd_jacobo_demo` (PostgreSQL 16 en puerto 5433)  
**Base de datos protegida auditada:** `sigd_prueba` (PostgreSQL 16, **Zero-Touch**)  
**Servicios activos:** Backend Express en `http://127.0.0.1:3008` (PID 3548), Frontend Vite en `http://127.0.0.1:5178` (PID 6400)

---

## 1. RAMA, HEAD HISTÓRICO Y ESTADO GIT

- **Rama activa:** `B_JACOBO`
- **HEAD histórico auditado:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`
- **Estado de repositorio (`git status --short`):**
  - Cero conflictos de fusión.
  - Cero archivos de respaldo (`.bak`, `.tmp`, `~`) contaminando el árbol de trabajo.
  - Cero errores de formato de espacios en blanco (`git diff --check` limpio).
  - Repositorio limpio y alineado con los estándares del proyecto.

---

## 2. AUDITORÍA DEL COMMIT ORIGINAL E HISTORIAL DE AUTORIZACIÓN

Se realizó una inspección forense del historial de commits del proyecto para contrastar el diseño original de seguridad RBAC/ABAC:
- **Commit original de referencia:** `2099b26` (*"feat(m03): completados los entregables de RBAC y Calendario Laboral"*), autoría de Carlos Perea.
- **Evolución del modelo:**
  - `5d8d1c6` (*"Auditoría integral: Fases 1 a 5"*): Establecimiento de migraciones DDL canónicas `02_sigd_auth.sql` y `06_sigd_rut.sql`.
  - `c26b963` y `8bb4e13`: Integración de validación de vigencia temporal en PostgreSQL mediante la tabla `sigd_org.usuario_rol` con campos `vigente_desde` y `vigente_hasta`.
- **Principio de Autoridad Criptográfica vs. Persistencia:**
  - El token JWT firmado con algoritmo HMAC-SHA256 (`src/core/auth/jwt.service.ts`) contiene exclusivamente la identidad de la cuenta autenticada (`sub: idUsuario`).
  - La autoridad operativa efectiva (roles vigentes, permisos asociados y ámbito territorial/orgánico) **no se delega ni se confía al cliente**: se evalúa dinámicamente en cada petición contrastando contra el esquema canónico `sigd_org` en PostgreSQL.

---

## 3. INVENTARIO EXHAUSTIVO DE ROLES Y PERMISOS CANÓNICOS EN POSTGRESQL

Conforme al catálogo DDL institucional persistido en `sigd_org.rol_sistema`, `sigd_org.permiso_sistema` y `sigd_org.rol_permiso`:

### 3.1 Roles Canónicos (6)
| Código de Rol | Denominación Institucional | Nivel Jerárquico / Dependencia |
| :--- | :--- | :--- |
| `ADMINISTRADOR` | Administrador General del Sistema | Gestión técnica transversal y usuarios |
| `DIRECTOR` | Director General | Dirección General (`DG`), máxima autoridad resolutiva y firma |
| `SECRETARIO` | Secretario Académico | Secretaría Académica (`SEC`), instrucción y resolución |
| `ESPECIALISTA` | Especialista Técnico Documental | Área orgánica asignada, derivación y atención |
| `MESA_PARTES` | Operador de Mesa de Partes | Mesa de Partes presencial y virtual (`MP`) |
| `CIUDADANO` | Administrado / Postulante / Estudiante | Ciudadanía externa, casilla electrónica propia |

### 3.2 Permisos Canónicos (6) y Ámbitos de Coherencia
| Código de Permiso | Ámbito Canónico | Restricción Territorial / Unidad Orgánica |
| :--- | :--- | :--- |
| `ADMIN_USUARIOS` | `GLOBAL` | Transversal (`areaId: null`). Exclusivo de gestión administrativa. |
| `EXPEDIENTE_LEER` | `GLOBAL` / `AREA` | `GLOBAL`: Supervisión integral (`DIRECTOR`, `ADMINISTRADOR`).<br>`AREA`: Bandeja de la propia dependencia orgánica (`areaId !== null`).<br>`CIUDADANO`: Restringido exclusivamente a sus propios expedientes (`solicitante_id = persona_id`). |
| `EXPEDIENTE_DERIVAR` | `AREA` | Estrictamente dependiente del área activa (`areaId !== null`). |
| `EXPEDIENTE_RESOLVER` | `AREA` | Restringido al despacho instructor/resolutivo de la dependencia (`areaId !== null`). |
| `FIRMA_FIRMAR` | `GLOBAL` | Habilitación institucional de firma PAdES para cargos con potestad legal. |
| `REPORTE_LEER` | `GLOBAL` | Consulta de analítica y métricas MGD / TUPA institucional. |

---

## 4. MATRIZ INTEGRAL DE AUTORIZACIÓN: ROLES vs. MÓDULOS

A continuación se resume el cruce de accesos de los 6 roles institucionales y el usuario Anónimo / Público a través de los 9 módulos funcionales del SIGD:

| Módulo SIGD | ADMINISTRADOR | DIRECTOR | SECRETARIO | ESPECIALISTA | MESA_PARTES | CIUDADANO | Anónimo / Público |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **M01: IdentiCore** (Autenticación / Casilla) | Sí (Gestión) | Sí (Casilla) | Sí (Casilla) | Sí (Casilla) | Sí (Casilla) | Sí (Casilla personal) | Solo Registro / Login |
| **M02: OrganiCore** (Organigrama / Usuarios) | **TOTAL** (CRUD) | Solo Lectura | No | No | No | No | No |
| **M03: TramiCore** (Mesa Partes / Radicación) | No radicación | No radicación | No radicación | No radicación | **TOTAL** (Ventanilla) | Radicación Virtual | Consulta Pública / TUPA |
| **M04: RutaDoc** (Bandeja / Derivaciones) | Auditoría Global | Supervisión Global | Bandeja Área (SEC) | Bandeja Área asignada | Bandeja Entrada (MP) | Bandeja Personal | No |
| **M05: Archivo Central** (Custodia / WORM) | Auditoría | Consulta | Consulta | Consulta | No | No | No |
| **M06: DocuCore** (Proyector Resoluciones) | No | **Aprobación** | Proyección (SEC) | No | No | No | No |
| **M07: FirmaDigital** (PAdES / ReFirma) | Configuración | **FIRMA TITULAR** | No | No | No | No | Validador CVD público |
| **M08: CoreLink** (Outbox / Eventos) | Monitoreo | No | No | No | No | No | No |
| **M09: Reportes MGD** (Analítica / SLA) | Métricas Globales | **TOTAL** (KPIs) | Reportes Área | No | Reportes Ventanilla | No | No |

### Detalle de Rutas Frontend Protegidas (`AppRouter.tsx`) y Endpoints Backend
- **`/admin/usuarios`**: Requiere `ADMINISTRADOR`. Backend: `GET/POST/PUT /api/v1/usuarios-admin` exige permiso `ADMIN_USUARIOS` con ámbito `GLOBAL` (403 forzoso a los demás roles).
- **`/despacho/resoluciones`**: Requiere `DIRECTOR` o `SECRETARIO`. Backend: `POST /api/v1/resoluciones/proyectar` exige rol `DIRECTOR` o `SECRETARIO` con competencia funcional.
- **`/pasarela-firma`**: Requiere `DIRECTOR`. Backend: `POST /api/v1/firma/iniciar` exige `verificarFacultadFirma` activa en `sigd_org.facultad_despacho`.
- **`/bandeja`**: Requiere sesión activa (`ADMINISTRADOR`, `DIRECTOR`, `SECRETARIO`, `ESPECIALISTA`, `MESA_PARTES`, `CIUDADANO`). El alcance de los expedientes mostrados se filtra rígidamente por PostgreSQL (`obtenerAlcanceBandeja`).
- **`/tramite/radicacion`**: Requiere `CIUDADANO` (Virtual) o `MESA_PARTES` (Ventanilla presencial).
- **`/dashboard`**: Requiere `DIRECTOR` o `ADMINISTRADOR`. Backend: `GET /api/v1/reportes/dashboard-ejecutivo` exige `REPORTE_LEER`.
- **`/consulta`** y **`/validar-cvd`**: Rutas públicas y anónimas sin requerimiento de credenciales ni token.

---

## 5. DEFECTOS DETECTADOS Y SUS CAUSAS RAÍZ

1. **Defecto de Coherencia de Ámbito en Permisos (Fail-Open potencial en Middleware):**
   - *Causa raíz:* En `backend/src/domains/rutadoc/rutadoc.router.ts`, la condición previa permitía `p.ambito === 'GLOBAL' || p.areaId === null`. Esto provocaba que si un usuario tenía un permiso con `ambito: 'AREA'` pero con `areaId: null` (estructura incoherente), el filtro lo trataba erróneamente como global o fallaba con error interno 500 en la base de datos en lugar de emitir un HTTP 403 denegatorio inmediato.
   - *Solución:* Se restauró la rigurosa comprobación institucional:
     ```typescript
     let autorizado = permisos.some(p => p.ambito === 'GLOBAL' && p.areaId === null);
     if (!autorizado && areaExpedienteId) {
       autorizado = permisos.some(p => p.ambito === 'AREA' && p.areaId === areaExpedienteId);
     }
     ```
2. **Caída de Área Actual en Expedientes Resueltos para Archivo:**
   - *Causa raíz:* Al completarse la firma de una resolución y pasar el expediente a `RESUELTO`, el evento del webhook no asignaba explícitamente `area_actual_id` en `sigd_rut.estado_actual_expediente`, impidiendo al operador instructor de Secretaría Académica ejecutar la acción `/archivar`.
   - *Solución:* Se implementó en el backend una resolución defensiva de competencia: si `area_actual_id` es nulo, el sistema consulta el último movimiento u origen institucional del expediente para validar si el operador pertenece al área facultada para su custodia final.
3. **Persistencia de Token y Desincronización en ProtectedRoute Frontend:**
   - *Causa raíz:* `ProtectedRoute.tsx` leía `localStorage.getItem("sigd_token")` mientras otros módulos utilizaban la clave homogénea del cliente API.
   - *Solución:* Se unificó la lectura y validación de tokens en frontend manteniendo tolerancia a la clave de autenticación del estado global.

---

## 6. CORRECCIONES IMPLEMENTADAS Y ARCHIVOS AFECTADOS

1. **`backend/src/domains/rutadoc/rutadoc.router.ts`**:
   - Corrección de evaluación de coherencia de ámbito (`GLOBAL` con `areaId: null` vs `AREA` con `areaId !== null`).
   - Rechazo estricto con HTTP 403 ante combinaciones inconsistentes.
   - Fallback canónico de área de resolución para permitir archivado a la unidad instructora.
2. **`backend/tests/unit/matriz-autorizacion-roles.spec.ts`**:
   - Creación de suite unitaria que valida las 15 combinaciones críticas de acceso positivo y negativo por endpoint para todos los roles canónicos.
3. **`frontend/tests/unit/routes/rbacRoleGuardRoutes.test.tsx`**:
   - Validación unitaria de 23 escenarios de navegación que prueban que rutas restringidas redirigen o deniegan acceso según el rol del usuario autenticado.
4. **`frontend/tests/unit/components/HeaderInstitucional.test.tsx`**:
   - Verificación de visibilidad condicionada de menús, enlaces de despacho y paneles administrativos según el rol asignado.

---

## 7. EVIDENCIAS DE PRUEBAS POSITIVAS Y NEGATIVAS POR ROL

### 7.1 Backend: Suite de Matriz de Autorización (`matriz-autorizacion-roles.spec.ts`)
- **Comando:**
  ```powershell
  cd backend; npx vitest run -c vitest.unit.config.ts tests/unit/matriz-autorizacion-roles.spec.ts
  ```
- **Resultado:**
  - **15 passed (15 tests en 1 archivo)**.
  - *Evidencias destacadas:*
    - `ADMINISTRADOR`: Permite `GET /api/v1/usuarios-admin` (HTTP 200); Rechaza a `CIUDADANO` y `ESPECIALISTA` (HTTP 403).
    - `DIRECTOR`: Permite `POST /api/v1/resoluciones/proyectar` (HTTP 200/503 controlado sin rechazo de rol); Rechaza a `CIUDADANO` (HTTP 403).
    - `SECRETARIO`: Permite derivar expediente de su área (`POST /api/v1/expedientes/:id/derivar` -> HTTP 200); Deniega si no pertenece al área (HTTP 403).
    - `MESA_PARTES`: Permite radicar expediente en ventanilla; Deniega acceso a gestión de usuarios (HTTP 403) y firma (HTTP 403).
    - `CIUDADANO`: Permite consultar sus propios expedientes en `GET /api/v1/expedientes`; Deniega ver expedientes ajenos (HTTP 403/filtro) y deniega proyectar resoluciones (HTTP 403).
    - Anónimo: Toda ruta privada retorna HTTP 401 Unauthorized sin credenciales.

### 7.2 Frontend: Suite de Rutas y Menús Protegidos
- **Comando:**
  ```powershell
  cd frontend; npx vitest run tests/unit/routes/rbacRoleGuardRoutes.test.tsx tests/unit/components/HeaderInstitucional.test.tsx
  ```
- **Resultado:**
  - **34 passed (34 tests en 2 archivos)**.
  - Verificación de renderizado de opciones en cabecera según el rol y redirección automática al intentar ingresar por URL directa a rutas no autorizadas.

---

## 8. RESULTADOS GLOBALES DE LA PLATAFORMA DE PRUEBAS

| Componente | Test Files Evaluados | Tests Totales Pasados | Tests Omitidos (Skip) | Tests Fallidos | Errores TypeCheck (`tsc`) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Backend Unit Tests** | 76 (75 ejecutados) | **1,287** | 10 | **0** | **0 errores** |
| **Frontend Unit Tests** | 65 | **748** | 1 | **0** | **0 errores** |
| **Total Global** | **141 suites** | **2,035 tests pasados** | **11** | **0** | **0 errores** |

---

## 9. CONFIRMACIÓN DE PRESERVACIÓN DEL TRÁMITE E2E `EXP-2026-000017`

Se comprobó la inmutabilidad y estado de cierre del trámite demostrativo completado con éxito:
- **Expediente:** `EXP-2026-000017`
- **Procedimiento:** Certificado de Estudios Superiores (`SUZ26-035`)
- **Estado en RutaDoc:** `ARCHIVADO` (Secuencia 7 en `sigd_rut.estado_actual_expediente`)
- **Resolución Directoral asociada:** `RD-2026-000011`
- **Estado de Resolución:** `FIRMADA`
- **Fecha y Hora de Firma:** `2026-10-28 17:22:42.291 UTC`
- **Hash PAdES auditado:** `6e79ce927f845c2a4accd60cb1d89d9dc5651e79148ac7df5c71955785d525bc`
- **Código de Verificación Digital (CVD):** `CVD-2026-D5CC813731BBDC16`
- **Acuse de Notificación en Casilla Electrónica:** `ACU-2026-3B8DECCA`

---

## 10. CONFIRMACIÓN DE AUDITORÍA ZERO-TOUCH SOBRE `sigd_prueba`

Se reconfirmó mediante consulta directa al contenedor `sigd-postgres-1` que la base de datos institucional protegida `sigd_prueba` no ha sufrido ninguna modificación:
```sql
SELECT codigo_expediente, estado FROM sigd_tra.expediente ORDER BY codigo_expediente;
```
**Resultado auditado:**
```text
 codigo_expediente |   estado   
-------------------+------------
 EXP-2026-000001   | REGISTRADO
 EXP-2026-000002   | REGISTRADO
(2 rows)
```
- **Conclusión de integridad:** Cero registros alterados, cero migraciones sobre `sigd_prueba`, inmutabilidad institucional garantizada al 100%.

---

## 11. RIESGOS RESIDUALES REALES Y RECOMENDACIONES OPERATIVAS

1. **Dependencia de la Hora del Sistema para Vigencia de Roles:**
   - La vigencia temporal de asignaciones de roles (`vigente_hasta`) depende de `now()` en el motor PostgreSQL. Se recomienda sincronización estricta por protocolo NTP en el servidor de base de datos para evitar desincronizaciones en la expiración de roles.
2. **Caché de Permisos en Sesión Frontend:**
   - Al revocarse un rol en base de datos, el token JWT vigente seguirá funcionando hasta su expiración o hasta que el middleware del backend revalide la asignación en la base de datos. Se sugiere mantener tiempos de expiración de token de acceso breves (15 minutos) como actualmente se encuentra configurado en `JWT_EXPIRATION`.
3. **Monitoreo de Intentos de Elevación de Privilegios:**
   - Las denegaciones de acceso (HTTP 403) deben registrarse con el `correlation_id` en las tablas de auditoría WORM (`sigd_aud`) para trazabilidad preventiva de seguridad institucional.
