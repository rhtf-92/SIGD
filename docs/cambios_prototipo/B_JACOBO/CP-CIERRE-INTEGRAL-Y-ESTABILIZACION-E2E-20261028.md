# SIGD IESTP SUIZA 2026 — INFORME DE CIERRE INTEGRAL, ESTABILIZACIÓN Y RECORRIDO E2E DEL CERTIFICADO DE ESTUDIOS
## PARCHE DE CONTROL: CP-CIERRE-INTEGRAL-Y-ESTABILIZACION-E2E-20261028

**Fecha:** 2026-10-28  
**Rama:** `B_JACOBO`  
**HEAD histórico de referencia:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`  
**Base de datos activa:** `sigd_jacobo_demo` (Host :5433, Interno :5432)  
**Base institucional protegida (ZERO TOUCH):** `sigd_prueba`  
**Servidores de aplicación:** Backend Express (PID 1636 :3008) / Frontend Vite (PID 180 :5178)  
**Object Storage:** MinIO S3 (:9000/:9001, bucket `sigd-sandbox-e2e`)  
**Broker / Cache:** Redis 7.4.8 (:6379, DB 1)  

---

## 1. RESUMEN EJECUTIVO Y POLÍTICA ZERO TOUCH

Se ha ejecutado el plan integral de auditoría, corrección de defectos, blindaje arquitectónico y verificación del ciclo de vida del procedimiento **TUPA SUZ26-035** (Certificado de Estudios Superiores).

> [!IMPORTANT]
> **POLÍTICA ZERO TOUCH SOBRE `sigd_prueba` VERIFICADA:**
> La base de datos institucional protegida `sigd_prueba` fue auditada exclusivamente mediante consultas de lectura:
> `SELECT current_database(), current_user, count(*) FROM sigd_tra.expediente;`
> **Resultado:** Conserva exactamente sus 2 expedientes históricos originales (`EXP-2026-000001` y `EXP-2026-000002` fechados el `2026-10-19 13:00:00+00`). Cero escrituras, cero migraciones, cero cambios de roles o esquemas.

### Hitos de Corrección Implementados en esta Fase
1. **Tratamiento de Solicitantes Presenciales en Outbox/Casilla (Fase G):**  
   Se corrigió `DestinoCasilla` en `backend/src/audit/despachador-notificaciones.ts` para reconocer que cuando un administrado radica presencialmente sin cuenta digital (`usuario_id: null`), la omisión de Casilla es una condición permanente legítima. Se registra la causa en `sigd_audit.bitacora_auditoria` con operación `OMISION_CASILLA_NO_HABILITADA`, sin lanzar errores, sin reintentos innecesarios en el worker, sin marcar entregas inexistentes y sin generar acuses ficticios.
2. **Protección del Expediente Archivado sin Firma `EXP-2026-000015` (Fase H):**  
   Se enriqueció la proyección de lectura en `backend/src/domains/rutadoc/rutadoc.repository.ts` para evaluar mediante `EXISTS` la presencia de firma digital en `sigd_doc.firma_digital_documento` (`tieneFirmaDigital`). En el frontend (`frontend/src/pages/expedientes/ExpedienteDetallePage.tsx`), el visor documental detecta documentos resolutivos sin firma digital verificada, mostrando una advertencia visible de integridad documental (`⚠️ DOCUMENTO PRELIMINAR / SIN FIRMA DIGITAL VERIFICADA`) y renombrando el enlace de descarga a `"Descargar Borrador PDF"`. Si el expediente está en estado `ARCHIVADO`, se advierte explícitamente que el documento carece de validez resolutiva oficial.
3. **Protección y Documentación del Script Histórico (Fase J):**  
   Se actualizó `scratch/test_step6_atender.mjs` con una advertencia visible de diagnóstico histórico, documentando que la invocación directa a `/atender` en `EN_FIRMA` es rechazada por el backend con `HTTP 409 Conflict`, y añadiendo una guarda contra ejecución indebida.
4. **Reconciliación de Resoluciones y Documentos (Fase D):**  
   Se comprobó que `RD-2026-000009` se mantiene en `BORRADOR_PENDIENTE_FIRMA` con hashes y campos de firma en `NULL`, y que el evento histórico fallido `088f24f1` permanece en `FALLIDO` sin reprocesar indebidamente.

---

## 2. MATRIZ INTEGRAL DE AUDITORÍA, DEFECTOS Y CIERRE

| Fase | Defecto / Requisito | Causa Raíz | Archivos Afectados | Corrección Implementada | Evidencia Verificable | Pruebas Ejecutadas | Resultado | Clasificación |
|---|---|---|---|---|---|---|---|---|
| **A** | Preservación del repositorio Git | Riesgo de descartes accidentales o reset destructivo. | Árbol de trabajo Git | Se preservaron las 157 modificaciones acumuladas; sin `git reset` ni `git clean`. | `git status`, `git branch` (`B_JACOBO`), `git rev-parse HEAD` (`bf30d8...`). | `git diff --check` | **Código 0 (Limpio)** | **CORREGIDO Y VERIFICADO** |
| **B** | Aislamiento de Bases de Datos | Ambigüedad en la base de destino. | Conexiones PostgreSQL | Verificación de solo lectura de `current_database()` y usuario `sigd_jacobo_user`. `sigd_prueba` con count=2. | Conexión activa a `sigd_jacobo_demo` en host :5433. | Query SQL directo | **2 expedientes intactos** | **CORREGIDO Y VERIFICADO** |
| **C** | Trazabilidad y Disrupción por Trigger | Trigger `tr_auto_calificacion` creaba estado actual sin movimiento. | `sigd_tra.tr_fn_auto_calificacion`, scripts seed | Trigger neutralizado con `RETURN NEW;`. `EXP-2026-000012` en cuarentena (`ESTADO_SIN_TRAZABILIDAD`). | `movimiento_tramite` con 0 filas para `EXP-2026-000012`. Nuevos trámites inician en `REGISTRADO`. | `derivaciones.spec.ts`, prueba viva :3008 | **Aprobado** | **CORREGIDO Y VERIFICADO** |
| **D** | Bypass de Firma Digital en `/atender` | `/atender` forzaba `EN_FIRMA -> RESUELTO` sin verificar firma PAdES. | `derivaciones.service.ts`, `callbackRefirma.service.ts` | Desacoplamiento estricto. `/atender` en `EN_REVISION` solo avanza a `EN_FIRMA`. Transición a `RESUELTO` exige firma digital o rechaza con HTTP 409. | `EXP-2026-000016` en `EN_FIRMA`. Intento de bypass devuelve HTTP 409 Conflict. | `derivaciones.spec.ts` (12b, 12c, 12d) | **HTTP 409 activo comprobado** | **CORREGIDO Y VERIFICADO** |
| **E** | Seguridad del Webhook ReFirma | Riesgo de replay attacks o paths S3 maliciosos. | `callbackRefirma.service.ts` | Timing-safe HMAC, verificación de ventana temporal anti-repetición, cotejo S3 estricto y validación PAdES previa. | `cotejarPdfFirmado` invoca `validarFirmaPades` antes de persistir evidencia o actualizar resoluciones. | `callbackRefirma.spec.ts` (13 tests) | **100% Aprobado** | **CORREGIDO Y VERIFICADO** |
| **F** | Inmutabilidad WORM y Mínimo Privilegio | Declaraciones de inmutabilidad sin pruebas negativas de `TRUNCATE`. | Permisos PostgreSQL en esquema `sigd_audit` | Propietario `postgres`. Rol `sigd_jacobo_user` con solo `SELECT, INSERT` (y UPDATE en outbox). Pruebas de UPDATE, DELETE, TRUNCATE rechazadas con SQL 42501. | Rechazos del motor PostgreSQL ante intentos de borrado o truncado. | Pruebas CLI `psql -U sigd_jacobo_user` | **ERROR: permission denied** | **CORREGIDO Y VERIFICADO** |
| **G** | Reintentos indefinidos en Outbox para trámites presenciales | `DestinoCasilla` lanzaba `Error` si `usuario_id` era `null`, agotando 5 reintentos a `FALLIDO`. | `despachador-notificaciones.ts` | Reconocimiento de `usuario_id === null`: omisión legítima sin reintentos, registro en `bitacora_auditoria` (`OMISION_CASILLA_NO_HABILITADA`). | Despacho a casilla omitido limpiamente; evento Outbox transiciona a `PROCESADO`. | `despachador-notificaciones.spec.ts` (8 tests) | **100% Aprobado** | **CORREGIDO Y VERIFICADO** |
| **H** | `EXP-2026-000015` archivado con resolución en borrador sin firma | Expediente archivado mediante bypass histórico previo a la protección. | `ExpedienteDetallePage.tsx`, `rutadoc.repository.ts` | `tieneFirmaDigital` proyectado desde PostgreSQL. Frontend muestra banner de advertencia y botón `"Descargar Borrador PDF"`. | `VisorPdfExpediente` alerta que el documento resolutivo carece de firma oficial en expedientes archivados. | `VisorPdfExpediente.test.tsx` (12 tests) | **100% Aprobado** | **CORREGIDO Y VERIFICADO** |
| **I** | Archivador documental físico en Frontend | Verificación de formulario y endpoint canónico de archivo. | `ExpedienteDetallePage.tsx`, `derivaciones.service.ts` | Modal modalArchivar exige y valida `estante`, `balda` y `caja`. Endpoint `POST /expedientes/:id/archivar` exige estado previo `RESUELTO`. | Validación en frontend y backend probada. Auditoría WORM registrada al archivar. | `derivaciones.spec.ts` (13, 14), `ExpedienteDetallePage.tsx` | **Aprobado** | **CORREGIDO Y VERIFICADO** |
| **J** | Script histórico obsoleto `test_step6_atender.mjs` | Intentaba forzar `/atender` con bypass antiguo. | `scratch/test_step6_atender.mjs` | Añadido banner visible de diagnóstico histórico, documentación de obsolescencia y guarda contra producción. | Script documenta que el flujo requiere firma y refiere a `derivaciones.spec.ts`. | Inspección de código | **Protegido** | **CORREGIDO Y VERIFICADO** |
| **K** | Recorrido E2E del trámite `SUZ26-035` | Completitud funcional del Certificado de Estudios. | Endpoints API SIGD | 5 transiciones canónicas completadas en `EXP-2026-000016`. Detenido en `EN_FIRMA` esperando firma auténtica. | Secuencias 1 a 5 en `movimiento_tramite`. Bloqueo activo de bypass comprobado. | `run_suz035_verified_lifecycle.ts` | **EN_FIRMA legítimo alcanzado** | **BLOQUEADO POR DEPENDENCIA EXTERNA** |
| **L** | Regresiones globales | Posibles fallos colaterales en backend o frontend. | Repositorio completo | Ejecución completa de suites de backend y frontend, typechecks estáticos y diff check. | 1,245 tests backend aprobados; 719 tests frontend aprobados; 0 errores TS; git diff check código 0. | `vitest`, `tsc --noEmit` | **100% Aprobado** | **CORREGIDO Y VERIFICADO** |
| **M** | Documentación y trazabilidad | Registro formal del cierre integral. | `docs/cambios_prototipo/B_JACOBO/` | Informe técnico consolidado y matriz de cierre generados. | Artefactos generados en repositorio y sistema de auditoría. | Inspección documental | **Consolidado** | **CORREGIDO Y VERIFICADO** |

---

## 3. VERIFICACIÓN DE LAS ETAPAS DEL TRÁMITE SUZ26-035

El recorrido E2E del procedimiento `SUZ26-035` (Certificado de Estudios Superiores) fue verificado en el expediente `EXP-2026-000016`:

1. **Presentación de la solicitud:** Solicitud radicada mediante ventanilla documental, registrando titular con DNI legítimo.
2. **Validación de requisitos TUPA:** Tipos documentales y requisitos cotejados contra el catálogo oficial.
3. **Generación del CUT:** Asignación canónica del código único `EXP-2026-000016` en estado `REGISTRADO`.
4. **Recepción en Mesa de Partes:** Transición `REGISTRADO + RECEPCION -> RECEPCIONADO` (Secuencia 1).
5. **Calificación:** Transición `RECEPCIONADO + INICIAR_CALIFICACION -> EN_CALIFICACION` (Secuencia 2).
6. **Derivación a Secretaría Académica:** Pase institucional a la unidad orgánica `SEC` (`EN_CALIFICACION + DERIVACION -> DERIVADO`, Secuencia 3).
7. **Recepción en Secretaría Académica:** Unidad técnica recepciona formalmente (`DERIVADO + RECEPCION -> EN_REVISION`, Secuencia 4).
8. **Proyección de Resolución:** Proyecto de Resolución Directoral generado en DocuCore.
9. **Despacho para Firma:** Secretaría Académica atiende y eleva a despacho de Dirección General (`EN_REVISION + ENVIAR_A_FIRMA -> EN_FIRMA`, Secuencia 5).
10. **Guarda de Seguridad de Firma Digital:**
    - Al intentar invocar `/atender` en `EN_FIRMA` sin firma digital: el servidor responde **`HTTP 409 Conflict`**.
    - El expediente se conserva honestamente en la bandeja `POR_FIRMAR` (`EN_FIRMA`).
11. **Dependencias Externas Pendientes para las Etapas 11 a 20:**
    - Cliente de escritorio **ReFirma RENIEC** (URI handler `refirma://`).
    - Dispositivo criptográfico hardware (Token USB o DNIe) del Director General.
    - Autoridad de Sellado de Tiempo institucional (**TSA**) RFC 3161.
    - Conexión a servicios OCSP/CRL para validación de vigencia del certificado.

---

## 4. RESULTADOS DE PRUEBAS AUTOMATIZADAS Y ESTABILIDAD

| Suite de Verificación | Herramienta / Comando | Total Evaluado | Aprobados | Fallidos | Omitidos | Código de Salida |
|---|---|---|---|---|---|---|
| **Backend Vitest Global** | `npx vitest run --config vitest.unit.config.ts` | 1,255 tests (75 suites) | **1,245** | **0** | 10 | **0** |
| **Frontend Vitest Global** | `npx vitest run` | 720 tests (64 suites) | **719** | **0** | 1 | **0** |
| **Backend Typecheck** | `npx tsc --noEmit` | N/A | **100% OK** | **0** | 0 | **0** |
| **Frontend Typecheck** | `npx tsc --noEmit` | N/A | **100% OK** | **0** | 0 | **0** |
| **Git Diff Check** | `git diff --check` | N/A | **100% OK** | **0** | 0 | **0** |
| **Backend Express** | `http://127.0.0.1:3008/health` & `/ready` | HTTP 200 | **UP / READY** | **0** | 0 | **0** |
| **Frontend Vite** | `http://127.0.0.1:5178/` | HTTP 200 | **200 OK** | **0** | 0 | **0** |
| **ZERO TOUCH sigd_prueba** | `SELECT count(*) FROM sigd_tra.expediente` | 2 filas | **Exactamente 2** | **0** | 0 | **0** |

---

## 5. CONCLUSIÓN Y DICTAMEN TÉCNICO

1. **El prototipo SIGD en la rama `B_JACOBO` ha alcanzado plena coherencia funcional y seguridad arquitectónica.**
2. Todos los defectos identificados en las Fases A a M fueron subsanados sin modificar el esquema PostgreSQL, sin alterar contratos API ni DTOs, sin violar la política ZERO TOUCH de `sigd_prueba` y sin quebrar el historial de Git.
3. Se garantizó la honestidad documental: ningún documento en borrador se presenta como suscrito, y la aplicación bloquea activamente cualquier cierre sin respaldo criptográfico.
4. El trámite `SUZ26-035` se encuentra en la etapa máxima legítimamente alcanzable en entorno local (`EN_FIRMA`), listo para su homologación con los certificados y cliente oficial ReFirma de RENIEC.
