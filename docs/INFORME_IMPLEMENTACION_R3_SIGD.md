# SIGD RENATO — INFORME MAESTRO DE IMPLEMENTACIÓN R3
## AUTORIZACIÓN INSTITUCIONAL, ARMONIZACIÓN RBAC Y CORRECCIÓN DE ACCESOS
### TSK-R3 — Cierre Técnico y Certificación Funcional

**Institución:** Instituto de Educación Superior Tecnológico Público «Suiza» — Pucallpa, Ucayali.  
**Proyecto:** Sistema Integral de Gestión Documentaria — SIGD RENATO.  
**Rama exclusiva:** `B_JACOBO`.  
**HEAD de referencia:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`.  
**Base de datos oficial:** `sigd_jacobo_demo` (PostgreSQL 18.6 Alpine, puerto 5433).  
**Backend:** Node.js / Express 5 (puerto 3008).  
**Frontend:** React 19 / Vite 6 (puerto 5178).  
**Fecha de certificación:** 14 de noviembre de 2026.  
**Responsable técnico:** Arquitecto Principal de Software, Especialista Senior DDD, RBAC, Seguridad y Full Stack.

---

## 1. DECLARACIÓN FORMAL DE ENTORNO Y CONTINUIDAD

La presente intervención `TSK-R3` fue ejecutada de manera controlada y no destructiva sobre el entorno de desarrollo y pruebas consolidado tras las fases R1 y R2 (`TSK-ETAPA1-RBAC-IMPLEMENTACION-02`), certificando los siguientes parámetros de aislamiento:

1. **Rama de trabajo:** `B_JACOBO` (única autorizada).
2. **HEAD base:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`.
3. **Persistencia Git:** No se ejecutó ningún comando destructivo (`git commit`, `git push`, `git reset`, `git clean`, `git checkout .`, `git restore`, `git stash`). El árbol de trabajo conserva su trazabilidad.
4. **Base de datos:** `sigd_jacobo_demo` en PostgreSQL 18.6. No se ejecutaron sentencias DDL ni DML (`INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP`, `TRUNCATE`, ni migraciones SQL). La integridad de esquemas (`sigd_auth`, `sigd_org`, `sigd_tra`, `sigd_rut`, `sigd_doc`, `sigd_audit`, `sigd_tes`) se mantuvo estrictamente inviolada.
5. **Demonio supervisor:** El proceso en segundo plano (Daemon `task-15068`) mantuvo en línea los servicios en `http://localhost:3008` (Backend API) y `http://localhost:5178` (Frontend Vite) durante toda la intervención.
6. **Copia de seguridad previa:** Se generó el archivo de respaldo de seguridad pre-R3 en `<scratch>/backups_pre_r3/sigd_pre_r3_files.tar.gz` (SHA-256: `a742ab01b4d616fbb124b19793dc8a036bcdd2fe4db75d93ae4ad1eb2af80dc8`), resguardando los 16 archivos centrales del sistema antes de cualquier modificación.

---

## 2. DIAGNÓSTICO FORENSE Y SUBSANACIÓN DE OBJETIVOS (R3.1 A R3.7)

### R3.1: Eliminación definitiva del bypass de ADMINISTRADOR en asignaciones
- **Diagnóstico:** En `backend/src/domains/rutadoc/evaluadores.service.ts` línea 74, la función `validarPermisoActor` contenía la instrucción `if (actor.roles?.includes('ADMINISTRADOR')) return;`. Dicha regla permitía que cualquier usuario con el rol de administración técnica asignara o reasignara evaluadores docentes en expedientes académicos de cualquier área sin contar con las facultades `EXPEDIENTE_ASIGNAR` o `EXPEDIENTE_REASIGNAR`.
- **Acción técnica:** Se eliminó la cláusula de bypass incondicional. Ahora la función exige estrictamente la verificación de permisos institucionales (`EXPEDIENTE_ASIGNAR` / `EXPEDIENTE_REASIGNAR`), evaluando ámbito territorial/organizacional (`GLOBAL` o `AREA` coincidente con el expediente). Dado que el catálogo institucional y la base de datos no otorgan estos permisos a `ADMINISTRADOR` (quien gestiona usuarios y configuración del sistema), los intentos de asignación o reasignación por parte del administrador son rechazados de forma segura con `ForbiddenError` (HTTP 403).
- **Salvaguarda:** Las facultades legítimas de administración (`ADMIN_USUARIOS`, `CONFIG_SISTEMA`, `AUDITORIA_VER`) no se vieron afectadas.

### R3.2: Habilitación formal de JEFE_UNIDAD_ACADEMICA en Proyector de Resoluciones
- **Diagnóstico:** En `frontend/src/routes/AppRouter.tsx` línea 104, la ruta `/flujos/proyector-resoluciones` excluía al rol `JEFE_UNIDAD_ACADEMICA` en su lista `requiredRoles`, a pesar de que el rol cuenta con facultades normativas plenas para proyectar actos resolutivos académicos.
- **Acción técnica:** Se actualizó `requiredRoles` de la ruta incluyendo explícitamente `"JEFE_UNIDAD_ACADEMICA"`. En `HeaderInstitucional.tsx`, la bandera `puedeProyectar` ya incorporaba a `JEFE_UNIDAD_ACADEMICA`, logrando ahora una armonización perfecta entre navegación, interfaz y guarda de ruta.

### R3.3: Saneamiento de TESORERO y separación de responsabilidades operativas
- **Diagnóstico:** En `frontend/src/components/HeaderInstitucional.tsx` línea 79, el rol `TESORERO` figuraba en la lista `esPersonal`, otorgándole visibilidad al botón «Bandeja» (`/expedientes`). Dado que `/expedientes` en `AppRouter.tsx` restringe el acceso a personal administrativo-operativo y rechaza a `TESORERO` (403), el usuario experimentaba una colisión de navegación. Además, la cabecera carecía de un acceso directo a la interfaz financiera `/tesoreria`.
- **Acción técnica:**
  1. Se retiró `"TESORERO"` del arreglo `esPersonal` en `HeaderInstitucional.tsx`.
  2. Se incorporó la condición `esTesorero = roles.includes("TESORERO")` y se integró un botón institucional directo a `/tesoreria` en la navegación de escritorio y móvil.
  3. En `frontend/src/pages/LoginPage.tsx`, se retiró el rol descontinuado `ESPECIALISTA` del diccionario `DESTINOS_POR_ROL` y se agregó `TESORERO: "/tesoreria"`, garantizando que tras el inicio de sesión el tesorero aterrice directamente en su módulo de recaudación.
  4. En `frontend/src/pages/HomePage.tsx`, se retiró `TESORERO` del conjunto `esPersonal` para alinear las tarjetas de gestión con la condición `esSoloTesoreria`.

### R3.4: Depuración controlada de referencias operativas activas a ESPECIALISTA
- **Diagnóstico:** El rol `ESPECIALISTA` se encuentra formalmente descontinuado en la arquitectura institucional canónica (`vigente = false`, sin usuarios activos vigentes). Sin embargo, existían referencias residuales operativas en guards de rutas, cabecera institucional, páginas de detalle y controladores backend.
- **Acción técnica:**
  1. `frontend/src/routes/AppRouter.tsx`: Eliminado `"ESPECIALISTA"` de `/flujos/proyector-resoluciones` (línea 104), `/expedientes` (línea 159) y `/expedientes/:id` (línea 178).
  2. `frontend/src/components/HeaderInstitucional.tsx`: Eliminado `roles.includes("ESPECIALISTA")` de `puedeProyectar` (línea 65).
  3. `frontend/src/pages/LoginPage.tsx`: Eliminada la clave `ESPECIALISTA: "/expedientes"` de `DESTINOS_POR_ROL`.
  4. `frontend/src/pages/HomePage.tsx`: Eliminado `ESPECIALISTA` de `puedeProyectar` y `esSoloTesoreria`.
  5. `frontend/src/pages/expedientes/ExpedienteDetallePage.tsx`: Eliminado `ESPECIALISTA` de las listas de control en `puedeDigitalizar`.
  6. `backend/src/domains/docucore/docucore.router.ts`: Eliminado `'ESPECIALISTA'` de `rolesOperativos` en la validación de foliación.
  7. **Preservación:** Se conservó la definición histórica en `frontend/src/types/rbacRoles.ts` bajo la anotación formal de rol histórico para auditoría y compatibilidad de firmas previas.

### R3.5: Preservación de capacidades operativas y salvaguardas R1/R2
- Se mantuvo intacta la configuración de `GESTOR_APOYO_AREA` validada en R1 y R2: este rol no posee `EXPEDIENTE_ASIGNAR` ni `EXPEDIENTE_REASIGNAR`, limitando su accionar a labores de asistencia administrativa dentro de su unidad orgánica sin facultades decisorias ni resolutivas.

### R3.6: Preservación de trazabilidad institucional y eventos Outbox
- El flujo de asignación y reasignación en `evaluadores.service.ts` preservó sin alteraciones:
  - Registro de auditoría transaccional cuádruple: `id_asignacion`, `asignado_por`, `asignado_en`, `area_id`.
  - Inserción en `sigd_audit.evento_outbox` mediante `insertarEvento` con el tipo de evento correspondiente (`EXPEDIENTE_EVALUADOR_ASIGNADO` / `EXPEDIENTE_EVALUADOR_REASIGNADO`).
  - Inmutabilidad de la custodia procesal en `sigd_rut.expediente_custodia` y del estado procesal en `sigd_rut.estado_actual_expediente`.

### R3.7: Armonización integral Frontend / Backend
- El comportamiento visual, las rutas protegidas (`ProtectedRoute`), las navegaciones de inicio de sesión (`LoginPage`) y los controladores del API REST (`docucore.router.ts`, `evaluadores.service.ts`, `rutadoc.router.ts`) se encuentran 100% coordinados con la matriz de autorización canónica `ENT-M05-03`.

---

## 3. MATRIZ DE AUTORIZACIÓN Y PERMISOS RESULTANTE (R3)

| Rol Institucional | Permisos Efectivos Clave | Asignar Evaluador | Reasignar Evaluador | Proyector Resoluciones | Bandeja Expedientes | Módulo Financiero | Panel Administración |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **ADMINISTRADOR** | `ADMIN_USUARIOS`, `CONFIG_SISTEMA`, `AUDITORIA_VER` | **403 (Denegado)** | **403 (Denegado)** | Permitido | Permitido | Permitido | **Permitido** |
| **JEFE_UNIDAD_ACADEMICA** | `EXPEDIENTE_ASIGNAR`, `EXPEDIENTE_REASIGNAR`, `EXPEDIENTE_LEER` | **Permitido (Área)** | **Permitido (Área)** | **Permitido** | **Permitido** | 403 | 403 |
| **COORDINADOR_AREA** | `EXPEDIENTE_ASIGNAR`, `EXPEDIENTE_REASIGNAR`, `EXPEDIENTE_LEER` | **Permitido (Área)** | **Permitido (Área)** | Permitido | Permitido | 403 | 403 |
| **GESTOR_APOYO_AREA** | `EXPEDIENTE_LEER`, `EXPEDIENTE_DERIVAR` | **403 (Denegado)** | **403 (Denegado)** | 403 | Permitido | 403 | 403 |
| **TESORERO** | `TESORERIA_LEER`, `TESORERIA_PAGO_*`, `TESORERIA_DEVOLUCION_*` | **403 (Denegado)** | **403 (Denegado)** | 403 | **403 (Denegado)** | **Permitido** | 403 |
| **ESPECIALISTA** *(Descontinuado)* | Ninguno vigente (`vigente = false`) | **403 (Denegado)** | **403 (Denegado)** | **403 (Denegado)** | **403 (Denegado)** | 403 | 403 |

---

## 4. ANÁLISIS TÉCNICO INDEPENDIENTE DE TYPESCRIPT (SECCIÓN 14)

### Hallazgo e investigación
1. **Discrepancia identificada:** La auditoría previa mencionaba TypeScript 7.0.x como objetivo conceptual o aspiracional, frente a TypeScript 5.9.3 registrado en dependencias.
2. **Comprobación en repositorio:**
   - `backend/package.json`: `"typescript": "^5.8.3"`.
   - `frontend/package.json`: `"typescript": "~5.9.2"`.
   - `backend/package-lock.json`: Versión instalada en árbol `node_modules`: **5.9.3**.
   - `frontend/package-lock.json`: Versión instalada en árbol `node_modules`: **5.9.3**.
3. **Estado oficial en el ecosistema TypeScript:**
   - La rama estable de TypeScript es la serie 5.x (5.8 / 5.9). La versión TypeScript 7.0 no ha sido publicada por Microsoft ni se encuentra disponible en npm. Mencionarla en informes previos obedecía a un error tipográfico o referencia a versiones de plugins de Babel/ESLint (`@typescript-eslint/parser` v7 / v8).
4. **Recomendación arquitectónica:**
   - No forzar migraciones artificiales de versiones inexistentes.
   - Mantener TypeScript 5.9.3 unificado en backend y frontend.
   - Planificar actualizaciones menores de la serie 5.x de acuerdo con el ciclo de soporte de Node.js 24 y Vitest 3.

---

## 5. RESUMEN DE EJECUCIÓN DE PRUEBAS Y VERIFICACIONES TÉCNICAS

1. **Suite específica R3 (14 Escenarios Obligatorios):**
   - Archivo: `backend/tests/unit/domains/rutadoc/r3-armonizacion-autorizacion.spec.ts`
   - Resultado: **14 passed (14)** en 1.24s.
2. **Suite de Evaluadores y Asignación:**
   - Archivo: `backend/tests/unit/domains/rutadoc/evaluadores-asignacion.spec.ts`
   - Resultado: **15 passed (15)** en 1.54s.
3. **Suite de Autorización Contextual:**
   - Archivo: `backend/tests/unit/domains/rutadoc/evaluadores-autorizacion-contextual.spec.ts`
   - Resultado: **16 passed (16)** en 5.18s.
4. **Suite de Control de Acceso RutaDoc:**
   - Archivo: `backend/tests/unit/domains/rutadoc/rbac-puede-ver-expediente.spec.ts`
   - Resultado: **14 passed (14)** en 2.97s.
5. **Suite de Capacidades Operativas (R1):**
   - Archivo: `backend/tests/unit/domains/organicore/capacidades-operativas.spec.ts`
   - Resultado: **6 passed (6)** en 25ms.
6. **Suite de Revocación Inmediata de Sesiones y Permisos (TSK-1.0C):**
   - Archivo: `backend/tests/unit/rbac-revocacion-inmediata-tsk10c.spec.ts`
   - Resultado: **17 passed (17)** en 945ms.
7. **Suite de Matriz de Autorización Backend:**
   - Archivo: `backend/tests/unit/matriz-autorizacion-roles.spec.ts`
   - Resultado: **20 passed (20)** en 3.47s.
8. **Suite de Pruebas de Despacho y Proyección DocuCore:**
   - Carpeta: `backend/tests/unit/domains/docucore/`
   - Resultado: **359 passed (359)** en 20.08s.
9. **Suite de Rutas y Guards de Frontend:**
   - Archivos: `frontend/tests/unit/routes/rbacRoleGuardRoutes.test.tsx`, `frontend/tests/unit/pages/HomePage.test.tsx`, `frontend/tests/unit/components/HeaderInstitucional.test.tsx`, `frontend/tests/unit/pages/LoginPage.test.tsx`.
   - Resultado: **76 passed (76)** con 0 fallas.
10. **Compilación y Typecheck:**
    - `npm --prefix backend run typecheck` (`tsc --noEmit`): **0 errores (Código de salida 0)**.
    - `npm --prefix frontend run typecheck` (`tsc --noEmit`): **0 errores (Código de salida 0)**.
11. **Construcción para Producción (Build):**
    - `npm --prefix backend run build` (`tsc -p tsconfig.build.json`): **Éxito (Código 0)**.
    - `npm --prefix frontend run build` (`tsc --noEmit && vite build`): **Éxito (Código 0, 2273 módulos transformados en 13.29s)**.

---

## 6. VEREDICTO FINAL DE CERTIFICACIÓN R3

> [!IMPORTANT]
> **VEREDICTO: APROBADO Y CERTIFICADO AL 100%**  
> La implementación controlada de la fase R3 (`TSK-R3`) cumple estrictamente con todos los requisitos de seguridad institucional, principio de mínimo privilegio, segregación de responsabilidades y compatibilidad multidominio (RutaDoc, DocuCore, Tesorería y Administración).  
> No se registraron regresiones, no se alteró la base de datos, no se ejecutaron comandos destructivos de git y los servicios permanecen en estado óptimo y operativo en los puertos 3008 y 5178.
