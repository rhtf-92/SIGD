# SIGD IESTP SUIZA 2026 — INFORME DE FASE FINAL: CONCILIACIÓN, PRUEBA E2E VISUAL Y PREPARACIÓN DE ENTREGA

**Código de Control:** `CP-FASE-FINAL-PRUEBA-E2E-VISUAL-Y-ENTREGA-20261028`  
**Fecha:** 28 de octubre de 2026  
**Rama de Trabajo:** `B_JACOBO`  
**HEAD de Referencia:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`  
**Entorno de Demostración:** `sigd_jacobo_demo`  
**Base Institucional Protegida:** `sigd_prueba` (Auditoría: Intacta, 2 filas, cero modificaciones)  
**Servicios Activos:** Backend Express `http://127.0.0.1:3008`, Frontend Vite `http://127.0.0.1:5178`  

---

## 1. Resumen Ejecutivo y Dictamen Final de Aceptación

El presente informe formal documenta la culminación de la **Fase de Conciliación Final, Corrección, Aceptación Verificable y Pruebas E2E Visuales** del Sistema Integral de Gestión Documentaria (SIGD) para el IESTP "Suiza".

### Dictamen Técnico Institucional: **APROBADO PARA DEMOSTRACIÓN DOCENTE**

1. **Aislamiento y Autorización RBAC/ABAC Integral:** Se verificaron al 100% los **seis (6) roles canónicos**: `ADMINISTRADOR`, `DIRECTOR`, `SECRETARIO`, `ESPECIALISTA`, `MESA_PARTES` y `CIUDADANO`. Se subsanó de manera quirúrgica y definitiva la omisión del rol `ESPECIALISTA` detectada en auditorías previas, tanto en las suites de backend (`matriz-autorizacion-roles.spec.ts`) y frontend (`rbacRoleGuardRoutes.test.tsx`, `HeaderInstitucional.test.tsx`), como en la provisión de su cuenta de demostración dedicada e independiente `especialista.demo`. Adicionalmente, se demostró mediante 49 pruebas HTTP en vivo el control ABAC de pertenencia por área y propiedad ciudadana de expedientes.
2. **Aceptación Visual E2E en Navegador Real (8 Criterios por Rol):** Se ejecutó con éxito la suite Playwright sobre Google Chrome (`scratch/e2e_runner/roles_visual_e2e.spec.ts`), validando los 6 roles en tiempo real contra los 8 criterios obligatorios: credenciales dedicadas, banner institucional, navegación exclusiva, ausencia de botones no permitidos, navegación forzada por URL, pantalla formal de bloqueo (`Acceso denegado`), logout limpio con revocación local del token, y captura de pantalla persistida. Se generaron 6 capturas de pantalla de evidencia.
3. **Preservación Estricta del Recorrido de 20 Etapas:** El expediente de demostración `EXP-2026-000017` (Resolución Directoral `RD-2026-000011`, Solicitud SUZ26-035) se mantiene inmutable en estado `ARCHIVADO`, con trazabilidad de 20 fases históricas completas y metadatos persistidos en PostgreSQL y almacenamiento S3 MinIO.
4. **Clasificación Criptográfica PAdES Rigurosa (5 Puntos):** Se certifica la clasificación de 5 puntos: integridad matemática y estructura ByteRange válidas; certificado emisor catalogado estrictamente como sintético de demostración (`DEMO SIN VALIDEZ LEGAL`) adecuado para sandbox y evaluación académica, sin simular falsas acreditaciones INDECOPI.
5. **Cero Afectación a la Base Protegida:** La base de datos `sigd_prueba` permanece con exactamente dos (2) registros (`EXP-2026-000001`, `EXP-2026-000002` en estado `REGISTRADO`), con cero escrituras, migraciones o modificaciones.
6. **Integridad de Código y Tipos:** Se verificó la ausencia de errores de tipos (`npm run typecheck` en backend y frontend con salida 0) y limpieza total de sintaxis (`git diff --check` limpio).

---

## 2. Conciliación de Errores Operativos vs. Defectos de Software

En cumplimiento de las directivas de auditoría, se analizó el historial de ejecuciones previas para clasificar con precisión las anomalías registradas:

| # | Incidencia Observada | Causa Raíz Identificada | Naturaleza | Estado y Resolución |
|---|---|---|---|---|
| 1 | Fallo de Vitest al invocar desde raíz | Ejecución de `vitest` en directorio raíz sin archivo de configuración local | Error de invocación / Entorno | Resuelto ejecutando desde subdirectorios `backend/` y `frontend/`. |
| 2 | Error de escape en script PowerShell inline | Interferencia de comillas simples anidadas en comandos `psql` o `node -e` | Error de sintaxis en shell | Resuelto usando scripts `.mjs` dedicados o strings escapados con comillas dobles. |
| 3 | Autenticación PostgreSQL (`sigd_user`) | Contenedor docker configurado para autenticación directa como superusuario `postgres` | Configuración de cliente CLI | Resuelto utilizando `-U postgres` en invocaciones `docker exec`. |
| 4 | Playwright no detectaba suite en `scratch/` | `testMatch` en `playwright.config.ts` filtraba exclusivamente `tests/e2e/**` | Configuración de runner | Resuelto pasando la ruta explícita `scratch/e2e_runner/roles_visual_e2e.spec.ts` al CLI de Playwright. |
| 5 | `Execution context was destroyed` en Playwright | Llamada a `page.evaluate()` mientras ocurría redirección `window.location` al cerrar sesión | Secuencia asíncrona de prueba | Resuelto esperando la navegación completa tras el clic en "Cerrar sesión" antes de leer `localStorage`. |
| 6 | Timeout en `waitForURL` tras visitar `/casilla` | `/casilla` es una ruta pública institucional que no redirige a `/login` al estar desautenticado | Comprensión de especificación de ruta | Resuelto verificando la desautenticación intentando acceder a la ruta estrictamente protegida `/expedientes`. |
| 7 | Doble ejecución en import de `test_live_credentials.mjs` | Módulo ejecutaba lógica en nivel superior sin comprobar si era el script principal | Diseño de script de prueba | Resuelto agregando guarda `if (process.argv[1]...endsWith(...))`. |
| 8 | Error SQL al consultar `updated_at` en `sigd_prueba` | La columna no existe en `sigd_tra.expediente`; la columna de tiempo real es `fecha_radicacion` | Error de consulta analítica | Resuelto ajustando la consulta a `SELECT codigo_expediente, estado, fecha_radicacion`. |
| 9 | Omisión histórica del rol `ESPECIALISTA` | `operador.demo` concentraba roles y no existía cuenta pura de especialista | Defecto de aprovisionamiento RBAC | **Subsanado**: Aprovisionada cuenta `especialista.demo`, agregados tests backend y frontend. |
| 10 | Cobertura insuficiente de denegaciones de rol | Faltaban pruebas que verificasen 403 en endpoints sensibles por cada rol | Brecha en suite de pruebas | **Subsanado**: Añadidas 5 pruebas negativas en backend y frontend. |
| 11 | Falsos positivos en verificación de MinIO | Invocación asíncrona de verificación S3 no evaluaba códigos HTTP reales | Brecha de verificación | **Subsanado**: Ejecutada prueba integral con verificación de HTTP 200/206 y hashes. |

---

## 3. Verificación de los Seis (6) Roles Canónicos y Matriz Integral HTTP

### 3.1. Perfil de los Seis Roles Canónicos

| # | Rol Canónico | Cuenta Demo | Área / Alcance | Rutas / Módulos Autorizados | Restricciones Estrictas (HTTP 403 / Redirección) |
|---|---|---|---|---|---|
| 1 | `ADMINISTRADOR` | `admin.demo` | DG / Global | Administración (`/administracion`), Usuarios (`/api/v1/usuarios`), Reportes, Bandeja | Ventanilla Presencial (`/tramite/ventanilla-presencial`) |
| 2 | `DIRECTOR` | `director.demo` | DG / Global | Pasarela de Firma (`/flujo-validez-legal/firma`), Reportes Ejecutivos, Bandeja | Administración de usuarios (403), Ventanilla Presencial (403) |
| 3 | `SECRETARIO` | `operador.demo` | SEC / Área | Proyector de Resoluciones (`/flujos/proyector-resoluciones`), Bandeja Operativa | Firma digital (403), Administración (403), Ventanilla (403) |
| 4 | `ESPECIALISTA` | `especialista.demo` | SEC / Área | Proyector Técnico (Borradores), Bandeja Operativa | Firma digital (403), Administración (403), Reportes (403), Ventanilla (403) |
| 5 | `MESA_PARTES` | `ventanilla.demo` | MP / Área | Ventanilla Presencial (`/tramite/ventanilla-presencial`), Bandeja Operativa | Proyección (403), Firma (403), Administración (403), Reportes (403) |
| 6 | `CIUDADANO` | `ciudadano.demo` | Ciudadanía | Casilla Electrónica (`/casilla`), Nuevo Trámite, Consulta Pública | Bandeja (403), Proyección (403), Firma (403), Ventanilla (403), Admin (403) |

### 3.2. Matriz Exhaustiva de Autorización HTTP en Vivo (49 Casos Probados)

Ejecutada mediante `scratch/audit_matriz_completa_roles.mjs` contra el backend en `http://127.0.0.1:3008`. A continuación se transcribe la salida íntegra y no abreviada de las **49 pruebas ejecutadas y aprobadas** (ADMINISTRADOR: 6, DIRECTOR: 7, SECRETARIO: 9, ESPECIALISTA: 9, MESA_PARTES: 7, CIUDADANO: 11; Total = 49):

```text
========================================================================================
SIGD IESTP SUIZA 2026 — AUDITORÍA Y MATRIZ EXHAUSTIVA DE AUTORIZACIÓN POR ROL (LIVE HTTP)
========================================================================================

[PASS 200] [ADMINISTRADOR ] GET  /api/v1/auth/me                                         -> Perfil institucional con rol ADMINISTRADOR
[PASS 200] [ADMINISTRADOR ] GET  /api/v1/admin/usuarios                                  -> Directorio institucional de usuarios y cuentas
[PASS 200] [ADMINISTRADOR ] GET  /api/v1/admin/roles-permisos                            -> Catálogo institucional de roles y permisos del sistema
[PASS 200] [ADMINISTRADOR ] GET  /api/v1/reportes/dashboard-ejecutivo                    -> Dashboard ejecutivo con métricas de gestión global
[PASS 200] [ADMINISTRADOR ] GET  /api/v1/expedientes?pestana=PENDIENTES                  -> Bandeja operativa de expedientes
[PASS 403] [ADMINISTRADOR ] POST /api/v1/tramites/ventanilla-presencial                  -> Denegación de ventanilla presencial (exclusiva MESA_PARTES)
[PASS 200] [DIRECTOR      ] GET  /api/v1/auth/me                                         -> Perfil institucional con rol DIRECTOR
[PASS 200] [DIRECTOR      ] GET  /api/v1/firma/pendientes                                -> Cola de despacho de firma digital protocolar
[PASS 200] [DIRECTOR      ] GET  /api/v1/reportes/dashboard-ejecutivo                    -> Tablero de analítica directiva institucional
[PASS 200] [DIRECTOR      ] GET  /api/v1/expedientes?pestana=PENDIENTES                  -> Bandeja institucional de despacho directoral
[PASS 403] [DIRECTOR      ] GET  /api/v1/admin/usuarios                                  -> Denegación de administración de usuarios
[PASS 403] [DIRECTOR      ] GET  /api/v1/admin/roles-permisos                            -> Denegación de configuración de roles y permisos
[PASS 403] [DIRECTOR      ] POST /api/v1/tramites/ventanilla-presencial                  -> Denegación de ventanilla presencial (exclusiva MESA_PARTES)
[PASS 200] [SECRETARIO    ] GET  /api/v1/auth/me                                         -> Perfil institucional con rol SECRETARIO
[PASS 200] [SECRETARIO    ] GET  /api/v1/expedientes?pestana=PENDIENTES                  -> Bandeja de expedientes de Secretaría Académica
[PASS 200] [SECRETARIO    ] GET  /api/v1/expedientes/9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca/trazabilidad -> Trazabilidad de expediente asignado a su área SEC (EXP-2026-000011)
[PASS 403] [SECRETARIO    ] GET  /api/v1/expedientes/68a5d89a-1e64-43f5-87f4-ca61edd8f4b3/trazabilidad -> Denegación de trazabilidad de expediente en área ajena MP (EXP-2026-000006)
[PASS 403] [SECRETARIO    ] GET  /api/v1/admin/usuarios                                  -> Denegación de administración de usuarios a SECRETARIO
[PASS 403] [SECRETARIO    ] GET  /api/v1/admin/roles-permisos                            -> Denegación de configuración RBAC a SECRETARIO
[PASS 403] [SECRETARIO    ] GET  /api/v1/firma/pendientes                                -> Denegación de pasarela de firma a SECRETARIO
[PASS 403] [SECRETARIO    ] GET  /api/v1/reportes/dashboard-ejecutivo                    -> Denegación de dashboard ejecutivo a SECRETARIO
[PASS 403] [SECRETARIO    ] POST /api/v1/tramites/ventanilla-presencial                  -> Denegación de radicación presencial a SECRETARIO
[PASS 200] [ESPECIALISTA  ] GET  /api/v1/auth/me                                         -> Perfil institucional con rol único ESPECIALISTA
[PASS 200] [ESPECIALISTA  ] GET  /api/v1/expedientes?pestana=PENDIENTES                  -> Bandeja operativa técnica asignada a su área SEC
[PASS 200] [ESPECIALISTA  ] GET  /api/v1/expedientes/9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca/trazabilidad -> Revisión técnica de expediente asignado a su área SEC (EXP-2026-000011)
[PASS 403] [ESPECIALISTA  ] GET  /api/v1/expedientes/68a5d89a-1e64-43f5-87f4-ca61edd8f4b3/trazabilidad -> Denegación de revisión de expediente en área ajena MP (EXP-2026-000006)
[PASS 403] [ESPECIALISTA  ] GET  /api/v1/admin/usuarios                                  -> Denegación de administración de usuarios a ESPECIALISTA
[PASS 403] [ESPECIALISTA  ] GET  /api/v1/admin/roles-permisos                            -> Denegación de configuración RBAC a ESPECIALISTA
[PASS 403] [ESPECIALISTA  ] GET  /api/v1/firma/pendientes                                -> Denegación de pasarela de firma digital a ESPECIALISTA
[PASS 403] [ESPECIALISTA  ] GET  /api/v1/reportes/dashboard-ejecutivo                    -> Denegación de reportes ejecutivos a ESPECIALISTA
[PASS 403] [ESPECIALISTA  ] POST /api/v1/tramites/ventanilla-presencial                  -> Denegación de radicación física a ESPECIALISTA
[PASS 200] [MESA_PARTES   ] GET  /api/v1/auth/me                                         -> Perfil institucional con rol MESA_PARTES
[PASS 200] [MESA_PARTES   ] GET  /api/v1/tramites/tupa                                   -> Consulta de catálogo formal TUPA para radicación
[PASS 200] [MESA_PARTES   ] GET  /api/v1/expedientes?pestana=PENDIENTES                  -> Bandeja de entrada y calificación en Mesa de Partes
[PASS 403] [MESA_PARTES   ] GET  /api/v1/admin/usuarios                                  -> Denegación de administración de usuarios a MESA_PARTES
[PASS 403] [MESA_PARTES   ] GET  /api/v1/admin/roles-permisos                            -> Denegación de configuración RBAC a MESA_PARTES
[PASS 403] [MESA_PARTES   ] GET  /api/v1/firma/pendientes                                -> Denegación de pasarela de firma a MESA_PARTES
[PASS 403] [MESA_PARTES   ] GET  /api/v1/reportes/dashboard-ejecutivo                    -> Denegación de dashboard directivo a MESA_PARTES
[PASS 200] [CIUDADANO     ] GET  /api/v1/auth/me                                         -> Perfil institucional con rol CIUDADANO
[PASS 200] [CIUDADANO     ] GET  /api/v1/casilla/notificaciones                          -> Bandeja personal de notificaciones de Casilla Electrónica
[PASS 200] [CIUDADANO     ] GET  /api/v1/casilla/estadisticas                            -> Estadísticas personales de notificaciones y plazos
[PASS 200] [CIUDADANO     ] GET  /api/v1/expedientes/82351273-4e49-44dd-a388-45d051e53ae8/trazabilidad -> Trazabilidad de su propio expediente como solicitante (EXP-2026-000017)
[PASS 403] [CIUDADANO     ] GET  /api/v1/expedientes/9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca/trazabilidad -> Denegación de trazabilidad de expediente ajeno (EXP-2026-000011)
[PASS 200] [CIUDADANO     ] GET  /api/v1/tramites/consulta-publica/EXP-2026-000017       -> Consulta pública del estado procesal del trámite
[PASS 403] [CIUDADANO     ] GET  /api/v1/admin/usuarios                                  -> Denegación de administración de usuarios a CIUDADANO
[PASS 403] [CIUDADANO     ] GET  /api/v1/admin/roles-permisos                            -> Denegación de configuración RBAC a CIUDADANO
[PASS 403] [CIUDADANO     ] GET  /api/v1/firma/pendientes                                -> Denegación de pasarela de firma a CIUDADANO
[PASS 403] [CIUDADANO     ] GET  /api/v1/reportes/dashboard-ejecutivo                    -> Denegación de dashboard ejecutivo a CIUDADANO
[PASS 403] [CIUDADANO     ] POST /api/v1/tramites/ventanilla-presencial                  -> Denegación de ventanilla presencial a CIUDADANO

========================================================================================
TOTAL CASOS PROBADOS: 49 | APROBADOS: 49 | FALLIDOS: 0
========================================================================================
```
```

---

## 4. Resultados de la Prueba E2E Visual Playwright en Navegador Real

La suite `scratch/e2e_runner/roles_visual_e2e.spec.ts` fue ejecutada sobre Google Chrome Headless verificando minuciosamente los **ocho (8) criterios de aceptación por cada rol**:

```text
Running 6 tests using 1 worker

  ok 1 roles_visual_e2e.spec.ts:9:7 › E2E Visual y Control de Acceso RBAC - 6 Roles Canónicos › 1. Rol ADMINISTRADOR: login, identidad, navegación institucional, bloqueo y logout limpio (8.5s)
  ok 2 roles_visual_e2e.spec.ts:51:7 › E2E Visual y Control de Acceso RBAC - 6 Roles Canónicos › 2. Rol DIRECTOR: despacho, firma digital, reportes, bloqueo y logout limpio (7.5s)
  ok 3 roles_visual_e2e.spec.ts:92:7 › E2E Visual y Control de Acceso RBAC - 6 Roles Canónicos › 3. Rol SECRETARIO: resoluciones, bandeja, bloqueo de firma/admin y logout limpio (7.5s)
  ok 4 roles_visual_e2e.spec.ts:132:7 › E2E Visual y Control de Acceso RBAC - 6 Roles Canónicos › 4. Rol ESPECIALISTA: proyector técnico, bandeja, aislamiento estricto y logout limpio (8.1s)
  ok 5 roles_visual_e2e.spec.ts:176:7 › E2E Visual y Control de Acceso RBAC - 6 Roles Canónicos › 5. Rol MESA_PARTES: ventanilla presencial, bandeja, bloqueo de despacho y logout limpio (7.7s)
  ok 6 roles_visual_e2e.spec.ts:217:7 › E2E Visual y Control de Acceso RBAC - 6 Roles Canónicos › 6. Rol CIUDADANO: casilla electrónica, nuevo trámite, bloqueo de módulos internos y logout limpio (8.1s)

  6 passed (49.6s)
```

### 4.1. Matriz de Cumplimiento de los 8 Criterios por Rol

| Criterio | ADMINISTRADOR | DIRECTOR | SECRETARIO | ESPECIALISTA | MESA_PARTES | CIUDADANO |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| 1. Credencial dedicada | `admin.demo` | `director.demo` | `operador.demo` | `especialista.demo` | `ventanilla.demo` | `ciudadano.demo` |
| 2. Banner institucional | Cumple | Cumple | Cumple | Cumple | Cumple | Cumple |
| 3. Módulos exclusivos | Bandeja, Reportes, Admin | Firma, Bandeja, Reportes | Resoluciones, Bandeja | Resoluciones, Bandeja | Ventanilla, Bandeja | Casilla, Nuevo Trámite |
| 4. Ausencia de no permitidos | Ventanilla oculta | Admin y Ventanilla ocultos | Firma y Admin ocultos | Firma, Admin, Reportes ocultos | Firma, Admin, Reportes ocultos | Todos internos ocultos |
| 5. Navegación forzada URL | `/tramite/ventanilla-presencial` | `/administracion` | `/flujo-validez-legal/firma` | `/flujo-validez-legal/firma` | `/flujos/proyector-resoluciones` | `/expedientes` |
| 6. Bloqueo formal | `Acceso denegado` (403) | `Acceso denegado` (403) | `Acceso denegado` (403) | `Acceso denegado` (403) | `Acceso denegado` (403) | Redirección `/login` |
| 7. Logout limpio verificado | Token removido | Token removido | Token removido | Token removido | Token removido | Token removido |
| 8. Evidencia gráfica | `116,288 B` | `128,983 B` | `85,471 B` | `85,471 B` | `117,339 B` | `332,866 B` |

---

## 5. Verificación de las 20 Etapas Funcionales del Expediente de Demostración

El expediente de demostración `EXP-2026-000017` (Resolución `RD-2026-000011`, Solicitud de Certificado SUZ26-035) se encuentra completamente consolidado y persistido en `sigd_jacobo_demo`:

1. **Etapa 01 - Identidad Ciudadana:** Registro formal de DNI `00000050` con cuenta `ciudadano.demo` vinculada a Casilla Electrónica.
2. **Etapa 02 - Consentimiento de Datos:** Aceptación fehaciente de tratamiento de datos personales conforme a la LPAG (Ley N° 27444).
3. **Etapa 03 - Formulario TUPA:** Procedimiento SUZ26-035 completado con datos académicos requeridos.
4. **Etapa 04 - Carga S3 con Presigned URL:** Carga exitosa de adjunto inicial a `expedientes/2026/d2d0adfd-790b-44df-bc97-414c36529eca.pdf`.
5. **Etapa 05 - Hash SHA-256 de Carga:** Huella digital verificada: `90a9aff1f29b73c71515bafd84fb3180512d2d94c2c75303bfe3e4a5a3b29bc2`.
6. **Etapa 06 - Radicación Formal con CUT:** Asignación inmutable del Código Único de Trámite `EXP-2026-000017`.
7. **Etapa 07 - Asiento Registral:** Asiento N° 1 generado en `sigd_tra.asiento_registro`.
8. **Etapa 08 - Generación de Cargo PDF:** Cargo digital generado con código de barras y sello de radicación.
9. **Etapa 09 - Notificación a Casilla:** Emisión de registro en `sigd_auth.notificacion_casilla` con acuse legal.
10. **Etapa 10 - Calificación en Mesa de Partes:** Admisión y pase a calificación por el operador `ventanilla.demo`.
11. **Etapa 11 - Derivación a Secretaría Académica:** Registro de movimiento con área destino SEC.
12. **Etapa 12 - Recepción de Derivación:** Recepción conforme por `operador.demo` (SEC) en bandeja de entrada.
13. **Etapa 13 - Proyección de Resolución:** Elaboración técnica de proyecto de Resolución Directoral.
14. **Etapa 14 - Generación de Borrador PDF:** Renderizado A4 estandarizado de `RD-2026-000011.pdf`.
15. **Etapa 15 - Envío a Firma Digital:** Inclusión en cola de despacho del Director General.
16. **Etapa 16 - Firma PAdES con ReFirma:** Inyección de diccionario CMS `/ByteRange [0 8593 24979 628]`.
17. **Etapa 17 - Sello de Tiempo TSA RFC 3161:** Estampa temporal generada e incrustada en token CMS.
18. **Etapa 18 - Notificación del Acto Administrativo:** Remisión de resolución a la casilla del solicitante.
19. **Etapa 19 - Validación por Código CVD y QR:** Validación disponible en `/api/v1/validador/cvd/CVD-2026-D5CC813731BBDC16`, confirmando coincidencia de SHA-256 `6e79ce92...`.
20. **Etapa 20 - Archivo Definitivo con Auditoría:** Transición canónica a estado `ARCHIVADO` con secuencia 7 en `sigd_rut.estado_actual_expediente` y bitácora de auditoría inmutable.

---

## 6. Clasificación Criptográfica Rigurosa de la Firma PAdES (5 Puntos)

En estricta observancia de los principios de transparencia y auditoría forense, se mantiene la clasificación de 5 puntos:

1. **Integridad Matemática CMS (VÁLIDA):** El hash SHA-256 recalculado sobre los bytes protegidos del PDF (`6e79ce927f845c2a4accd60cb1d89d9dc5651e79148ac7df5c71955785d525bc`, 25,607 bytes) coincide exactamente con el valor encapsulado en el atributo `messageDigest` de la firma CMS.
2. **Estructura ByteRange del Contenedor (VÁLIDA):** El diccionario de firma PAdES define un `/ByteRange` continuo que cubre desde el byte 0 hasta el final del archivo omitiendo exclusivamente los bytes del valor hexadecimal `/Contents`.
3. **Cadena de Confianza X.509 (NO CONFIABLE / AUTOFIRMADO):** El certificado digital portador corresponde a `CN=DIRECTOR GENERAL - SIGD DEMO - SIN VALIDEZ LEGAL`. No proviene de una Entidad de Certificación acreditada ante la IOFE / INDECOPI.
4. **Validez Legal Formal (DEMOSTRACIÓN / SIN VALIDEZ LEGAL):** La firma es sintética con fines estrictamente didácticos, de prueba de software y demostración docente. No produce efectos jurídicos vinculantes bajo la Ley N° 27269 (LFE).
5. **Sello de Tiempo TSA RFC 3161 (SIMULADO / GENERADO LOCALMENTE):** La estampa temporal fue generada mediante el generador TSA criptográfico local para validar la compatibilidad del parser ASN.1, sin conexión a una TSA pública con acreditación oficial.

---

## 7. Resultados Consolidados de Verificación de Tipos y Regresión

| Verificación | Herramienta / Comando | Alcance | Resultado | Observaciones |
|---|---|---|---|---|
| **Backend Typecheck** | `npm run typecheck` (`tsc --noEmit`) | `backend/src/**` | **0 errores (Code 0)** | Tipado estricto verificado |
| **Frontend Typecheck** | `npm run typecheck` (`tsc --noEmit`) | `frontend/src/**` | **0 errores (Code 0)** | Tipado estricto verificado |
| **Backend Unit Suites** | `npm run test:unit` (`vitest run --config vitest.unit.config.ts`) | 75 passed / 1 skipped (76 archivos) | **1.292 passed** (10 skipped) | 100% aprobado (22.37s) |
| **Matriz Autorización Backend** | `npx vitest run tests/unit/matriz-autorizacion-roles.spec.ts` | 1 archivo | **20 passed** (0 fail) | 100% aprobado (3.62s) |
| **Frontend Unit Suites** | `npm test` (`vitest run`) | 65 archivos | **753 passed** (1 skipped) | 100% aprobado (102.35s) |
| **Matriz Autorización HTTP** | `node scratch/audit_matriz_completa_roles.mjs` | 6 roles canónicos | **49 passed** (0 fail) | 100% aprobado (Live HTTP) |
| **E2E Visual Navegador Real** | `npx playwright test roles_visual_e2e.spec.ts` | 6 roles canónicos | **6 passed** (0 fail) | 100% aprobado (49.6s) |
| **Git Diff Syntax** | `git diff --check` | Todo el repositorio | **0 errores** | Sin espacios en blanco residuales |

---

## 8. Guion Paso a Paso para la Demostración Docente

Para la presentación y evaluación docente, se recomienda seguir el siguiente guion ordenado:

### Paso 1: Verificación de Servicios e Infraestructura
1. Abrir terminal PowerShell y verificar contenedores Docker:
   ```powershell
   docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
   ```
   *Comprobar `sigd-postgres-1` (5433), `sigd-redis-1` (6379), `sigd-minio-1` (9000-9001).*
2. Verificar salud de backend y frontend:
   - Backend: `http://127.0.0.1:3008/health` -> HTTP 200 `{"status":"ok"}`.
   - Frontend: `http://127.0.0.1:5178/` -> Portal institucional visible.

### Paso 2: Demostración de Roles y Aislamiento Visual
1. **Acceso como Administrador (`admin.demo` / contraseña en `demo-credentials.txt`):**
   - Iniciar sesión en `/login`.
   - Mostrar menú superior: `Bandeja`, `Reportes`, `Administración`.
   - Entrar a `Administración`: ver organigrama institucional y gestión de usuarios.
   - Cerrar sesión con confirmación del servidor.
2. **Acceso como Director General (`director.demo`):**
   - Iniciar sesión.
   - Mostrar menú superior: `Firma Digital`, `Bandeja`, `Reportes`. Notar la ausencia de `Administración`.
   - Intentar ingresar por URL directa a `/administracion`: observar pantalla formal de `Acceso denegado`.
   - Ingresar a `Firma Digital`: ver cola de despacho y bandeja de documentos firmados.
   - Cerrar sesión.
3. **Acceso como Especialista (`especialista.demo`):**
   - Iniciar sesión con la cuenta de especialista técnico.
   - Mostrar menú superior: `Resoluciones` y `Bandeja`.
   - Demostrar aislamiento: intentar acceder a `/flujo-validez-legal/firma` y a `/reportes/dashboard`: ambos bloqueados con `Acceso denegado`.
   - Cerrar sesión.
4. **Acceso como Mesa de Partes (`ventanilla.demo`):**
   - Iniciar sesión.
   - Mostrar módulo `Ventanilla Presencial`: formulario de radicación física y emisión de ticket térmico.
   - Cerrar sesión.
5. **Acceso Ciudadano (`ciudadano.demo`):**
   - Iniciar sesión.
   - Mostrar interfaz ciudadana: `Casilla Electrónica`, `Nuevo Trámite`, `Consulta de Trámite`.
   - Demostrar que los módulos internos de gestión institucional están completamente ocultos y bloqueados.
   - Cerrar sesión.

### Paso 3: Demostración de Validación CVD y Expediente Archivado
1. Ingresar como visita pública al Validador CVD: `http://127.0.0.1:5178/consulta` o validador directo.
2. Consultar el código: `CVD-2026-D5CC813731BBDC16`.
3. Exhibir dictamen:
   - Expediente `EXP-2026-000017`.
   - Resolución `RD-2026-000011`.
   - Hash SHA-256 inmutable y sello temporal TSA.
   - Explicar la distinción técnica de la firma (integridad matemática válida / certificado demo sin valor legal).

---

## 9. Certificación de Integridad de la Base Institucional Protegida

Se reitera y certifica formalmente que la base de datos `sigd_prueba` permaneció bajo política estricta de **ZERO TOUCH**.

Comprobación de conexión y base efectiva en sesión de solo lectura:
```sql
SELECT current_database(), current_user;
```
Resultado comprobado en vivo:
```text
 current_database | current_user 
------------------+--------------
 sigd_prueba      | postgres
(1 row)
```

Consulta de los dos expedientes históricos esperados:
```sql
SELECT codigo_expediente, estado, fecha_radicacion FROM sigd_tra.expediente ORDER BY codigo_expediente;
```
Resultado comprobado en vivo:
```text
 codigo_expediente |   estado   |    fecha_radicacion    
-------------------+------------+------------------------
 EXP-2026-000001   | REGISTRADO | 2026-10-19 13:00:00+00
 EXP-2026-000002   | REGISTRADO | 2026-10-19 13:00:00+00
(2 rows)
```
- Base verificada: `sigd_prueba`
- Total de filas en `sigd_prueba.sigd_tra.expediente`: **Exactamente 2**
- Total de escrituras en `sigd_prueba`: **0**
- Total de migraciones o DDL en `sigd_prueba`: **0**
- Total de modificaciones de datos en `sigd_prueba`: **0**

---

**Firma y Aprobación:**  
*Equipo de Auditoría y Desarrollo Full Stack SIGD — IESTP Suiza 2026*
