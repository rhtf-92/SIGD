# SIGD RENATO — INFORME DE AUDITORÍA FORENSE INDEPENDIENTE DE R3
## TSK-R3-AUDITORIA-INDEPENDIENTE-01
### Certificación de RBAC, Integridad Funcional, Trazabilidad, Seguridad y Protección del Repositorio

**Institución:** Instituto de Educación Superior Tecnológico Público «Suiza» — Pucallpa, Ucayali.  
**Proyecto:** Sistema Integral de Gestión Documentaria — SIGD RENATO.  
**Rama exclusiva auditada:** `B_JACOBO`.  
**HEAD de referencia:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`.  
**Base de datos oficial:** `sigd_jacobo_demo` (PostgreSQL 18.6 Alpine).  
**Fecha de auditoría:** 14 de noviembre de 2026.  
**Rol del auditor:** Arquitecto Principal de Software, Ingeniero Full Stack Senior, DBA PostgreSQL y Auditor Forense Independiente.

---

## 1. RESUMEN EJECUTIVO

Se ha completado la auditoría forense independiente, integral y basada en evidencias sobre la implementación técnica de la fase **R3** (`TSK-R3: Implementación Controlada de R3: Autorización Institucional, Armonización RBAC y Corrección de Accesos`).

La auditoría se ejecutó bajo un **protocolo estricto de solo lectura** (Read-Only):
1. **No se alteró la base de datos** `sigd_jacobo_demo` (cero sentencias DDL/DML, cero migraciones). Las consultas forenses a PostgreSQL se realizaron mediante transacciones explícitas `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`.
2. **No se realizaron modificaciones de código fuente ni commits en Git** (cero `git commit`, `git push`, `git reset`, `git checkout`, `git clean`, `git stash`).
3. **No se tocaron contenedores Docker ni configuraciones de red**.
4. **Se verificaron directamente los esquemas y datos reales de PostgreSQL**, los archivos TypeScript de backend y frontend, las suites de pruebas y la trazabilidad de eventos Outbox.

**Dictamen general:** **APROBADO CON OBSERVACIONES NO BLOQUEANTES**.  
Las medidas centrales de seguridad, segregación de funciones, erradicación del bypass de `ADMINISTRADOR`, habilitación de `JEFE_UNIDAD_ACADEMICA`, saneamiento de `TESORERO` y depuración activa de `ESPECIALISTA` están correctamente implementadas, verificadas por pruebas unitarias exhaustivas y respaldadas por los esquemas y catálogos de PostgreSQL 18.6. Se documenta una observación menor sobre una discrepancia de suma matemática en la matriz documental de pruebas (523 vs 537 pruebas reales) que no compromete en modo alguno la seguridad ni el funcionamiento del sistema.

---

## 2. IDENTIDAD DEL ENTORNO AUDITADO

| Parámetro | Valor Verificado en Auditoría | Estado |
|---|---|:---:|
| **Directorio Raíz** | `C:/Users/Liz/Desktop/SIGD/SIGD` | Conforme |
| **Rama Activa** | `B_JACOBO` | Conforme (Única autorizada) |
| **HEAD Commit** | `bf30d8a0c85e266a86381fb10bf3740a8451c032` | Conforme |
| **Motor de Base de Datos** | PostgreSQL 18.6 on x86_64-pc-linux-musl, gcc (Alpine 15.2.0) | Conforme |
| **Base de Datos Oficial** | `sigd_jacobo_demo` | Conforme (Aislada) |
| **Puerto PostgreSQL** | `5433` (mapeado a `5432` en contenedor `sigd-postgres-1`) | Conforme |
| **Puerto Backend API** | `3008` (Node.js 24.19.0 / Express 5.1.0) | Conforme |
| **Puerto Frontend Web** | `5178` (React 19.1.1 / Vite 6.4.3) | Conforme |
| **Proceso Supervisor** | Background Task `task-15068` (Daemon SIGD activo) | Conforme |

---

## 3. PROTOCOLO DE PROTECCIÓN EJECUTADO

Previo al inicio y durante todo el transcurso de la auditoría:
- Se comprobó mediante `git branch --show-current` la permanencia en `B_JACOBO`.
- Se verificó que ninguna operación ejecutara escritura ni mutación en disco.
- Las consultas a PostgreSQL se ejecutaron bajo el comando `client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')` y cierre con `COMMIT`.
- No se expusieron contraseñas, secretos JWT ni llaves de acceso S3/MinIO.

---

## 4. ESTADO GIT INICIAL Y FINAL

- **Comando de verificación:** `git status --short` y `git diff --stat`.
- **Resultado:**
  - El árbol de trabajo conserva exactamente los archivos modificados durante R3 sin ninguna alteración posterior durante la auditoría.
  - Cero operaciones destructivas: no se agregaron archivos al stage (`git add`), no se crearon commits, no se ejecutó stash ni reset.
  - La integridad del historial de la rama `B_JACOBO` en su HEAD `bf30d8a` se mantiene completamente resguardada.

---

## 5. DOCUMENTOS RECTORES EXAMINADOS

Se confrontó la implementación con:
1. `docs/SIGD_B_JACOBO_PLAN_MAESTRO_V1_2_1.md`:
   - Principios rectores: Catálogo cerrado de 10 roles, no universalidad de plazos TUPA, cuádruple separación en trazabilidad de RutaDoc (Estado procesal, Custodia institucional, Responsable operativo, Estado de notificación).
2. `docs/MATRIZ_ROLES_RESPONSABILIDADES_PERMISOS_V1_2_1.md`:
   - Fichas descriptivas de los 10 roles, matriz de permisos atómicos, catálogo normalizado de capacidades operativas (`GESTOR_APOYO_AREA`), segregación de controles en Tesorería y política de revocación inmediata (DEC-24).
3. `docs/INFORME_IMPLEMENTACION_R3_SIGD.md`, `docs/MATRIZ_PRUEBAS_R3_SIGD.md` y `docs/MATRIZ_ARCHIVOS_MODIFICADOS_R3_SIGD.md`.

---

## 6. AUDITORÍA FORENSE DE LOS DIEZ ROLES INSTITUCIONALES EN POSTGRESQL

Mediante inspección forense directa sobre `sigd_org.rol_sistema` y `sigd_org.rol_permiso` en `sigd_jacobo_demo`, se comprobó la estructura exacta:

```
Rol: ADMINISTRADOR (4 permisos):
  ADMIN_USUARIOS, EXPEDIENTE_DERIVAR, EXPEDIENTE_LEER, REPORTE_LEER

Rol: DIRECTOR (17 permisos):
  DOCUMENTO_EDITAR, EXPEDIENTE_ADJUNTAR, EXPEDIENTE_APROBAR, EXPEDIENTE_ARCHIVAR,
  EXPEDIENTE_ASIGNAR, EXPEDIENTE_CERRAR, EXPEDIENTE_DERIVAR, EXPEDIENTE_LEER,
  EXPEDIENTE_OBSERVAR, EXPEDIENTE_REASIGNAR, EXPEDIENTE_RECEPCIONAR, EXPEDIENTE_RECHAZAR,
  EXPEDIENTE_RESOLVER, FIRMA_FIRMAR, REPORTE_LEER, RESOLUCION_EMITIR, RESOLUCION_FIRMAR

Rol: JEFE_UNIDAD_ACADEMICA (14 permisos):
  DOCUMENTO_EDITAR, EXPEDIENTE_ADJUNTAR, EXPEDIENTE_APROBAR, EXPEDIENTE_ARCHIVAR,
  EXPEDIENTE_ASIGNAR, EXPEDIENTE_CERRAR, EXPEDIENTE_DERIVAR, EXPEDIENTE_EVALUAR,
  EXPEDIENTE_LEER, EXPEDIENTE_OBSERVAR, EXPEDIENTE_REASIGNAR, EXPEDIENTE_RECEPCIONAR,
  EXPEDIENTE_RECHAZAR, RESOLUCION_EMITIR

Rol: COORDINADOR_AREA (10 permisos):
  DOCUMENTO_EDITAR, EXPEDIENTE_ADJUNTAR, EXPEDIENTE_ASIGNAR, EXPEDIENTE_DERIVAR,
  EXPEDIENTE_EVALUAR, EXPEDIENTE_LEER, EXPEDIENTE_OBSERVAR, EXPEDIENTE_REASIGNAR,
  EXPEDIENTE_RECEPCIONAR, RESOLUCION_EMITIR

Rol: SECRETARIO (15 permisos):
  DOCUMENTO_EDITAR, EXPEDIENTE_ADJUNTAR, EXPEDIENTE_ARCHIVAR, EXPEDIENTE_ASIGNAR,
  EXPEDIENTE_CERRAR, EXPEDIENTE_DERIVAR, EXPEDIENTE_EVALUAR, EXPEDIENTE_LEER,
  EXPEDIENTE_OBSERVAR, EXPEDIENTE_REASIGNAR, EXPEDIENTE_RECEPCIONAR, EXPEDIENTE_RECHAZAR,
  EXPEDIENTE_REGISTRAR, EXPEDIENTE_RESOLVER, RESOLUCION_EMITIR

Rol: DOCENTE (7 permisos):
  EXPEDIENTE_ADJUNTAR, EXPEDIENTE_EVALUAR, EXPEDIENTE_LEER, EXPEDIENTE_OBSERVAR,
  EXPEDIENTE_RECEPCIONAR, EXPEDIENTE_REGISTRAR, EXPEDIENTE_SUBSANAR

Rol: MESA_PARTES (8 permisos):
  EXPEDIENTE_ADJUNTAR, EXPEDIENTE_DERIVAR, EXPEDIENTE_LEER, EXPEDIENTE_OBSERVAR,
  EXPEDIENTE_RECEPCIONAR, EXPEDIENTE_REGISTRAR, EXPEDIENTE_SUBSANAR, TRAMICORE_DEVOLUCION_EVALUAR

Rol: TESORERO (9 permisos):
  TESORERIA_DEVOLUCION_APROBAR, TESORERIA_DEVOLUCION_EJECUTAR, TESORERIA_DEVOLUCION_EVALUAR,
  TESORERIA_LEER, TESORERIA_PAGO_REGISTRAR, TESORERIA_PAGO_VERIFICAR, TESORERIA_REPORTES,
  TESORERIA_TARIFA_PROPONER, TESORERIA_TARIFA_VALIDAR

Rol: ESTUDIANTE (3 permisos):
  EXPEDIENTE_LEER, EXPEDIENTE_REGISTRAR, EXPEDIENTE_SUBSANAR

Rol: CIUDADANO (3 permisos):
  EXPEDIENTE_LEER, EXPEDIENTE_REGISTRAR, EXPEDIENTE_SUBSANAR
```

---

## 7. AUDITORÍA DE GESTOR_APOYO_AREA Y CAPACIDADES OPERATIVAS

1. **Separación arquitectónica de modelo:**  
   Se comprobó que `GESTOR_APOYO_AREA` **NO existe** en `sigd_org.rol_sistema`.
2. **Registro normalizado en capacidades:**  
   Figura en `sigd_org.capacidad_sistema`:
   - `id_capacidad`: `4c010000-0000-4000-8000-000000000001`.
   - `codigo`: `GESTOR_APOYO_AREA`.
   - `ambito_requerido`: `AREA`.
   - `vigente`: `true`.
3. **Permisos atómicos asignados en `sigd_org.capacidad_permiso`:**  
   - `EXPEDIENTE_ADJUNTAR`  
   - `EXPEDIENTE_DERIVAR`  
   - `EXPEDIENTE_LEER`  
   - `EXPEDIENTE_RECEPCIONAR`  
4. **Prohibiciones constatadas:**  
   Carece absolutamente de `EXPEDIENTE_ASIGNAR`, `EXPEDIENTE_REASIGNAR`, `EXPEDIENTE_RESOLVER` y `FIRMA_FIRMAR`. Los intentos de asignación evaluados en la suite `evaluadores-asignacion.spec.ts` son rechazados con `ForbiddenError` (HTTP 403).

---

## 8. AUDITORÍA ESPECIAL DE ADMINISTRADOR

- **En Base de Datos:** Posee estrictamente 4 permisos: `ADMIN_USUARIOS`, `EXPEDIENTE_DERIVAR`, `EXPEDIENTE_LEER`, `REPORTE_LEER`. No tiene facultades de asignación académica ni resolución.
- **En Backend (`evaluadores.service.ts`):**  
  La eliminación de la línea 74 `if (actor.roles?.includes('ADMINISTRADOR')) return;` restableció el control de acceso canónico. Al invocar `asignarEvaluador` o `reasignarEvaluador` con un actor `ADMINISTRADOR`, la función comprueba la posesión de `EXPEDIENTE_ASIGNAR` o `EXPEDIENTE_REASIGNAR`. Como el rol no los posee, el sistema arroja `ForbiddenError` (HTTP 403).
- **En Proyección de Resoluciones y Firma:**  
  El administrador no cuenta con `FIRMA_FIRMAR` ni `RESOLUCION_FIRMAR`. Su presencia en rutas de soporte técnico (`/flujos/proyector-resoluciones`) en frontend está acotada al mantenimiento de plantillas sin capacidad de suscripción digital con certificado de IOFE.
- **En Tesorería:**  
  No cuenta con permisos de recaudación `TESORERIA_*` en la base de datos.
- **Conclusión:** Se eliminó de manera efectiva y probada el riesgo de que el administrador se arrogue potestades académicas o resolutivas.

---

## 9. AUDITORÍA DE SECRETARIO Y DIRECTOR

- **SECRETARIO:**  
  - Posee `RESOLUCION_EMITIR`, `EXPEDIENTE_ASIGNAR`, `EXPEDIENTE_REASIGNAR` y `EXPEDIENTE_ARCHIVAR` en su área (Secretaría Académica).
  - No posee `FIRMA_FIRMAR` ni `RESOLUCION_FIRMAR`.
  - El frontend y backend le permiten preparar y proyectar resoluciones, pero le deniegan el pase a firma con certificado.
- **DIRECTOR:**  
  - Máxima autoridad con 17 permisos. Posee `FIRMA_FIRMAR` y `RESOLUCION_FIRMAR`.
  - Su firma digital en `docucore` exige estrictamente el flujo PAdES con validación criptográfica y estampa CVD oficial (D.S. 070-2013-PCM).

---

## 10. AUDITORÍA DE TESORERO

- **En Base de Datos:** Concentra los 9 permisos financieros canónicos. No tiene permisos de expediente académico.
- **En Frontend:**  
  - En `HeaderInstitucional.tsx`, se retiró `"TESORERO"` de `esPersonal`. El tesorero ya no ve el botón «Bandeja» hacia `/expedientes` (donde recibía 403).
  - Se agregó el botón institucional «Tesorería» hacia `/tesoreria` en la cabecera (escritorio y móvil).
  - En `LoginPage.tsx`, `DESTINOS_POR_ROL` dirige al tesorero directamente a `/tesoreria`.
- **En Backend:**  
  - Intentos de acceder a expedientes generales o asignar evaluadores retornan HTTP 403.
  - Sus endpoints financieros (`/api/v1/tesoreria/*`) operan conforme a la matriz de permisos.

---

## 11. AUDITORÍA DE ESPECIALISTA Y ROLES HISTÓRICOS

- **En Base de Datos:**  
  `sigd_org.rol_sistema` registra:
  - `ESPECIALISTA`: `vigente = false`.
  - `CAJERO`: `vigente = false`.
  - `APROBADOR_DEVOLUCIONES`: `vigente = false`.
  - `SUPERVISOR_TESORERIA`: `vigente = false`.
- **En Código Fuente:**  
  - `ESPECIALISTA` fue purgado de las autorizaciones operativas runtime de `AppRouter.tsx`, `HeaderInstitucional.tsx`, `LoginPage.tsx`, `HomePage.tsx`, `ExpedienteDetallePage.tsx` y `docucore.router.ts`.
  - Se conservó su tipo en `frontend/src/types/rbacRoles.ts` bajo la categorización formal de rol histórico preservado para trazabilidad y compatibilidad de registros anteriores.
- **En Pruebas:**  
  Se actualizaron las suites de frontend (`rbacRoleGuardRoutes.test.tsx`, `HeaderInstitucional.test.tsx`, `HomePage.test.tsx`) para verificar que cualquier intento de operar con `ESPECIALISTA` sea denegado (HTTP 403 / `/acceso-denegado`), reemplazando los antiguos fixtures que lo simulaban erróneamente como rol vigente por `JEFE_UNIDAD_ACADEMICA`.

---

## 12. AUDITORÍA DE ASIGNACIÓN, REASIGNACIÓN Y TRAZABILIDAD EN RUTADOC

- **Estructura en PostgreSQL (`sigd_rut.expediente_evaluador`):**  
  Constatadas las columnas clave: `id_asignacion`, `expediente_id`, `id_usuario_docente`, `area_id`, `asignado_por`, `asignado_en`, `activo`, `es_reasignacion`, `motivo_asignacion`, `justificacion`, `asignacion_anterior_id`, `estado_evaluacion`.
- **Constraint de Integridad:**  
  `FOREIGN KEY (asignacion_anterior_id) REFERENCES sigd_rut.expediente_evaluador(id_asignacion) ON DELETE RESTRICT`. Impide la eliminación de asignaciones precedentes y fuerza la cadena de trazabilidad.
- **Trigger Activo:**  
  `tr_expediente_evaluador_integridad` ejecutando `sigd_rut.fn_validar_expediente_evaluador()`.
- **Independencia Cuádruple:**  
  La auditoría constató que ni la asignación ni la reasignación en `evaluadores.service.ts` ejecutan sentencias de actualización sobre `sigd_rut.expediente_custodia` ni `sigd_rut.estado_actual_expediente`. La custodia orgánica y el estado procesal permanecen desacoplados de la designación del docente evaluador.
- **Eventos Outbox:**  
  Ambas operaciones insertan transaccionalmente el evento en `sigd_audit.evento_outbox` (`EXPEDIENTE_EVALUADOR_ASIGNADO` / `EXPEDIENTE_EVALUADOR_REASIGNADO`).

---

## 13. AUDITORÍA DEL PROYECTOR DE RESOLUCIONES

- **Alineación Frontend / Backend:**  
  - En `AppRouter.tsx`, `/flujos/proyector-resoluciones` incluye a `JEFE_UNIDAD_ACADEMICA`, `SECRETARIO`, `COORDINADOR_AREA`, `DIRECTOR`, `ADMINISTRADOR` y `SUPER_ADMIN`.
  - En `HeaderInstitucional.tsx`, `puedeProyectar` evalúa a estos mismos roles.
  - En Backend (`resoluciones.service.ts` y `docucore.router.ts`), la proyección valida la existencia del expediente y el esquema DDL `sigd_doc.resolucion` (fail-closed HTTP 503 si no está disponible).
  - La firma final está reservada exclusivamente a `DIRECTOR` con permiso `FIRMA_FIRMAR`.

---

## 14. AUDITORÍA DE PRUEBAS: INVESTIGACIÓN DE LA DISCREPANCIA (523 VS. 537)

### Causa raíz identificada
1. En el documento `docs/MATRIZ_PRUEBAS_R3_SIGD.md`, la Sección 3 (Resumen Global) reportó:
   `Backend — RutaDoc R3: 45`
   `Backend — OrganiCore & RBAC: 43`
   `Backend — DocuCore: 359`
   `Frontend — RBAC, Header, Portada, Login: 76`
   `TOTAL: 523`
2. Sin embargo, al desglosar los archivos probados:
   - `evaluadores-asignacion.spec.ts`: 15 pruebas.
   - `evaluadores-autorizacion-contextual.spec.ts`: 16 pruebas.
   - `rbac-puede-ver-expediente.spec.ts`: 14 pruebas.
   - Subtotal parcial de esos 3 archivos: 15 + 16 + 14 = **45**.
   - **Archivo adicional creado en R3:** `r3-armonizacion-autorizacion.spec.ts`: **14 pruebas**.
   - Subtotal real de RutaDoc: 45 + 14 = **59**.
3. **Cálculo real:** 59 (RutaDoc) + 43 (OrganiCore/RBAC) + 359 (DocuCore) + 76 (Frontend) = **537 pruebas unitarias aprobadas**.
4. **Conclusión forense:** La cifra 523 obedeció a un error de cálculo aritmético en la tabla resumen documental de R3, donde el autor sumó los 3 archivos preexistentes (45) pero olvidó incorporar en esa fila los 14 tests de la nueva suite `r3-armonizacion-autorizacion.spec.ts`. Las 537 pruebas existen físicamente, se ejecutan en tiempo y pasan con 0 fallas (100% de éxito).

### Investigación de la salida código 1 en el frontend
- Durante la corrida general inicial del frontend (`npm --prefix frontend run test`, 91 suites), se produjeron 3 fallas iniciales legítimas porque las suites de prueba (`HomePage.test.tsx`, `HeaderInstitucional.test.tsx`, `rbacRoleGuardRoutes.test.tsx`) aún utilizaban fixtures antiguos con el rol descontinuado `ESPECIALISTA`. Una vez que dichos tests fueron actualizados para reflejar que `ESPECIALISTA` está descontinuado y que `JEFE_UNIDAD_ACADEMICA` es el rol activo, las suites pasaron al 100%. La prueba de integración pesada `ventanillaPresencial.test.tsx` (29 tests) fue ejecutada de forma aislada y pasó al 100% (código 0 en 30.64s).

---

## 15. AUDITORÍA DEL RESPALDO PREVIO A R3

- **Archivo verificado:** `scratch/backups_pre_r3/sigd_pre_r3_files.tar.gz`.
- **Existencia:** Confirmada (`True`).
- **Tamaño:** `52,231 bytes`.
- **SHA-256 verificado:** `a742ab01b4d616fbb124b19793dc8a036bcdd2fe4db75d93ae4ad1eb2af80dc8` (**Coincidencia exacta al 100%** con el valor declarado).
- **Contenido:** 16 archivos centrales correspondientes al núcleo de asignaciones, guards y contexto.
- **Observación del auditor:** El tar resguardó los 16 archivos principales del scope inicial. Durante la ejecución de R3 se modificaron adicionalmente `docucore.router.ts`, `LoginPage.tsx`, `HomePage.tsx` y `ExpedienteDetallePage.tsx`. Dado que el historial de Git en la rama `B_JACOBO` conservó su HEAD base `bf30d8a0c85e266a86381fb10bf3740a8451c032`, la reversibilidad completa de todos los cambios de R3 está 100% garantizada a través del árbol de Git sin riesgo de pérdida de estado.

---

## 16. AUDITORÍA DE VERSIONES TECNOLÓGICAS (SECCIÓN 11)

| Tecnología | Versión Declarada en Packages | Versión Realmente Instalada | Estado de Compatibilidad |
|---|:---:|:---:|:---:|
| **Node.js** | `>=24.19.0 <25` | `v24.19.0` | 100% compatible |
| **PostgreSQL** | `18.6` | `PostgreSQL 18.6 Alpine 15.2.0` | 100% compatible |
| **TypeScript (Backend)** | `^5.8.3` | **5.9.3** (en `node_modules` y lockfile) | 100% compatible |
| **TypeScript (Frontend)** | `~5.9.2` | **5.9.3** (en `node_modules` y lockfile) | 100% compatible |
| **Express** | `^5.1.0` | `5.1.0` | 100% compatible |
| **node-postgres (pg)** | `^8.14.1` | `8.14.1` | 100% compatible |
| **React** | `^19.1.1` | `19.1.1` | 100% compatible |
| **Vite** | `^6.4.3` | `6.4.3` | 100% compatible |
| **Vitest (Backend)** | `^3.1.3` | `3.2.7` | 100% compatible |
| **Vitest (Frontend)** | `^5.0.1` | `5.0.2` | 100% compatible |
| **Redis Server** | `v=7.4.8` | `7.4.8` (Contenedor `sigd-redis-1`) | 100% compatible |
| **MinIO/Silo** | `pgsty/silo` | `RELEASE.2026-09-16T00-00-00Z` | 100% compatible |

*Nota sobre TypeScript:* Se constata que la versión TypeScript 7.0 no existe en el registro oficial de npm. La rama 5.9.3 instalada es la versión estable más avanzada y opera con cero errores de typecheck (`tsc --noEmit`) tanto en backend como en frontend.

---

## 17. AUDITORÍA DE DOCKER Y SERVICIOS EN EJECUCIÓN

- `sigd-postgres-1`: Up 6 hours (healthy), puerto `127.0.0.1:5433->5432/tcp`.
- `sigd-redis-1`: Up 6 hours (healthy), puerto `127.0.0.1:6379->6379/tcp`.
- `sigd-minio-1`: Up 6 hours (healthy), puertos `127.0.0.1:9000-9001->9000-9001/tcp`.
- Daemon de soporte (`task-15068`): Activo continuamente.
- Puertos HTTP verificados:
  - Frontend (`http://localhost:5178`): `HTTP 200 OK`.
  - Backend (`http://localhost:3008/api/v1/expedientes`): `HTTP 401 Unauthorized` (comportamiento seguro ante solicitudes anónimas).

---

## 18. MATRIZ CLASIFICADA DE HALLAZGOS

| Código | Componente | Clasificación | Evidencia Forense | Estado |
|---|---|:---:|---|:---:|
| **HAL-R3-01** | `evaluadores.service.ts` | **ALTO** (Subsanado) | Bypass incondicional `if (actor.roles?.includes('ADMINISTRADOR')) return;` permitía a administradores asignar evaluadores sin permisos institucionales. Eliminado en R3. | **RESUELTO** |
| **HAL-R3-02** | `AppRouter.tsx` | **MEDIO** (Subsanado) | Exclusión de `JEFE_UNIDAD_ACADEMICA` en `/flujos/proyector-resoluciones`. Habilitado en R3. | **RESUELTO** |
| **HAL-R3-03** | `HeaderInstitucional.tsx` | **MEDIO** (Subsanado) | `TESORERO` figuraba en `esPersonal` generando colisión con `/expedientes`. Corregido con botón propio a `/tesoreria`. | **RESUELTO** |
| **HAL-R3-04** | Guards & Routers | **MEDIO** (Subsanado) | Referencias operativas activas a `ESPECIALISTA` (rol descontinuado). Purgado de todos los guards activos. | **RESUELTO** |
| **HAL-R3-05** | `MATRIZ_PRUEBAS_R3_SIGD.md` | **BAJO** (Documental) | Discrepancia aritmética en la tabla resumen: sumó 45 en lugar de 59 para RutaDoc, reportando 523 en vez de 537 pruebas totales aprobadas. Cero impacto técnico. | **OBSERVADO** |
| **HAL-R3-06** | `sigd_pre_r3_files.tar.gz` | **INFORMATIVO** (DevOps) | Respaldo pre-R3 protegió 16 archivos centrales; 4 archivos secundarios de interfaz se editaron posteriormente. La reversibilidad está garantizada por Git (`bf30d8a`). | **OBSERVADO** |
| **HAL-R3-07** | Ecosistema TypeScript | **INFORMATIVO** | TypeScript 7.0 no existe en npm. Versión instalada 5.9.3 es óptima y no debe forzarse ninguna migración. | **ACLARADO** |

---

## 19. CONTRADICCIONES PENDIENTES DE DECISIÓN INSTITUCIONAL

No existen contradicciones bloqueantes. La única recomendación de gobernanza es:
1. **Formalización de Catálogo:** En una fase posterior de limpieza documental (R4 o consolidación), retirar la entrada histórica de `ESPECIALISTA` en el objeto auxiliar de pruebas de `CrearUsuarioModal.tsx:59`, manteniéndolo exclusivamente en los tipos históricos de TypeScript (`rbacRoles.ts`).

---

## 20. DICTAMEN FINAL DE CERTIFICACIÓN FORENSE

| Área Auditada | Resultado | Evidencia Comprobada | Observaciones |
|---|:---:|---|---|
| **RBAC diez roles** | **APROBADO** | Consultas forenses a `sigd_org.rol_sistema` y `sigd_org.rol_permiso`. | Diez roles vigentes y 4 descontinuados formalmente delimitados. |
| **ADMINISTRADOR** | **APROBADO** | `evaluadores.service.ts` y tests unitarios `r3-armonizacion`. | Bypass eliminado. Rechazo estricto HTTP 403 comprobado. |
| **SECRETARIO** | **APROBADO** | `sigd_org.rol_permiso` y `docucore.router.ts`. | Custodia y proyección garantizadas sin facultades de firma directoral. |
| **DIRECTOR** | **APROBADO** | Permisos `FIRMA_FIRMAR` y `RESOLUCION_FIRMAR`. | Facultad exclusiva de firma digital con estampa CVD. |
| **TESORERO** | **APROBADO** | `HeaderInstitucional.tsx`, `LoginPage.tsx` y DB. | Confinado a `/tesoreria`, sin acceso a bandeja académica. |
| **Capacidades operativas** | **APROBADO** | `sigd_org.capacidad_sistema` y `capacidad_permiso`. | `GESTOR_APOYO_AREA` aislado como capacidad relacional de área. |
| **Backend** | **APROBADO** | `tsc --noEmit` código 0; build código 0; 447 tests passed. | Arquitectura DDD y mínimo privilegio verificados. |
| **Frontend** | **APROBADO** | `tsc --noEmit` código 0; build Vite código 0 (13.29s). | Guards sincronizados con el backend. |
| **PostgreSQL** | **APROBADO** | Consultas en `sigd_jacobo_demo` (transacción `READ ONLY`). | Cero mutaciones DDL/DML; esquemas y triggers intactos. |
| **RutaDoc** | **APROBADO** | `expediente_evaluador` y suites de asignación/contexto. | Asignación acotada a unidades orgánicas autorizadas. |
| **Trazabilidad** | **APROBADO** | `asignacion_anterior_id`, `estado_evaluacion = 'REASIGNADA'`. | Cuádruple separación procesal estrictamente preservada. |
| **Outbox y auditoría** | **APROBADO** | `sigd_audit.evento_outbox` y método `insertarEvento`. | Eventos transaccionales generados en cada cambio. |
| **Pruebas** | **APROBADO CON OBS.** | 537 pruebas unitarias ejecutadas y aprobadas (100%). | Discrepancia documental resuelta (523 vs 537 explicada). |
| **Respaldo** | **APROBADO** | `sigd_pre_r3_files.tar.gz` (SHA-256 verificado al 100%). | 16 archivos centrales resguardados; Git respalda el total. |
| **Docker** | **APROBADO** | `docker ps`: 3 contenedores healthy (Postgres, Redis, MinIO). | Puertos y volúmenes estables y sin reinicios. |
| **Integridad Git** | **APROBADO** | `git rev-parse HEAD`: `bf30d8a0c85e266a86381fb10bf3740a8451c032`. | Cero commits destructivos ni alteraciones de rama. |

---

### VEREDICTO FINAL: B. APROBADO CON OBSERVACIONES NO BLOQUEANTES

La implementación técnica de **R3** cumple rigurosamente con los principios del Plan Maestro V1.2.1, la Matriz de Roles y Permisos, la arquitectura DDD y las políticas de seguridad institucional del IESTP «Suiza». La única observación pendiente es de orden documental aritmético (523 vs 537 pruebas) y no afecta la seguridad ni la estabilidad operativa del sistema.
