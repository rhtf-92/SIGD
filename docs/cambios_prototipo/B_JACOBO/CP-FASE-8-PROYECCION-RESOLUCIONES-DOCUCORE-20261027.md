# SIGD IESTP SUIZA 2026 — INFORME TÉCNICO DE FASE 8
## IMPLEMENTACIÓN, INTEGRACIÓN Y PRUEBA E2E DE PROYECCIÓN DE RESOLUCIONES EN DOCUCORE

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD) — IESTP Suiza 2026  
**Rama:** `B_JACOBO`  
**HEAD de referencia:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`  
**Fecha:** 27 de octubre de 2026  
**Módulo:** DocuCore (Validez Legal, Proyección de Resoluciones y Documentos Oficiales)  
**Operador actuante:** `operador.demo` (Secretaría Académica · UUID: `00000000-0000-0000-0000-000000000030`, ID numérico: `990000003`)  
**Expediente objetivo:** `EXP-2026-000011` (`9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca`)  
**Procedimiento TUPA:** `SUZ26-050` — Derecho de Reincorporación (Reingreso)  
**Resolución proyectada:** `RD-2026-000009` (UUID: `a2c988cb-f5d5-4a0d-944d-e34451ce3be1`)  
**Dictamen final:** **ACEPTADO (100% FUNCIONAL Y PERSISTIDO)**  

---

## 1. ESTADO INICIAL DEL REPOSITORIO Y ENTORNO

Antes de iniciar cualquier modificación o ejecución, se inspeccionó exhaustivamente el repositorio, la configuración y el entorno Docker:

| Parámetro | Estado Inicial | Verificación |
| :--- | :--- | :--- |
| **Rama de trabajo** | `B_JACOBO` | `git branch --show-current` |
| **Commit HEAD** | `bf30d8a0c85e266a86381fb10bf3740a8451c032` | `git rev-parse HEAD` |
| **Archivos preexistentes preservados** | 156 modificados previamente por Codex/Antigravity | `git status --short` intacto |
| **Base institucional protegida** | `sigd_prueba` (puerto 5432) | Exactamente 2 registros (`ZERO TOUCH`) |
| **Base de prototipo** | `sigd_jacobo_demo` (puerto 5433) | 11 expedientes, correlativo asiento 10010 |
| **Estado RutaDoc del expediente** | `EN_REVISION`, secuencia 3 | Operador `990000003`, área `SEC` (`2b147b0d-7c8f-434f-b75a-598a1ccb855b`) |
| **Estado TramiCore del expediente** | `RECEPCIONADO` | CUT: `EXP-2026-000011` |
| **Estado DocuCore del expediente** | `REGISTRADO` | Sincronizado con TUPA `SUZ26-050` |
| **Resoluciones previas en BD** | 4 resoluciones (`RD-2026-000002`, `0004`, `0006`, `0008`) | 0 resoluciones para `EXP-2026-000011` |
| **Servicios locales** | Backend (3008: `/health` 200 OK), Frontend (5178: 200 OK) | MinIO (9000/9001: OK), Redis (6379: OK) |

---

## 2. DEFECTOS DETECTADOS Y CAUSA RAÍZ

Durante la auditoría del código de DocuCore se identificaron los siguientes defectos:

### Defecto 1: Doble incremento en la asignación del correlativo anual
- **Ubicación:** `backend/src/domains/docucore/resoluciones.service.ts` (`asignarNumeroAnual`, líneas 198–209).
- **Causa Raíz:** La sentencia SQL sumaba `+ 1` al valor máximo de la base de datos (`SELECT COALESCE(MAX(...), 0) + 1 AS correlativo`), y posteriormente el código TypeScript volvía a sumar `+ 1` mediante `const siguiente = Math.max(maxDb, previo) + 1`. Esto generaba que se omitieran todos los números impares (explicando por qué las resoluciones históricas eran 2, 4, 6 y 8). Al evaluar la siguiente resolución con base en el 8, el cálculo resultaba en `8 + 1 = 9` en SQL, y luego `9 + 1 = 10` en TypeScript, saltándose indebidamente el correlativo esperado `RD-2026-000009`.
- **Corrección:** Se normalizó la consulta SQL a `SELECT COALESCE(MAX(...), 0) AS max_correlativo`, permitiendo que `Math.max(maxDb, previo) + 1` en TypeScript asigne de forma consecutiva y atómica el siguiente número disponible (`8 + 1 = 9`).

### Defecto 2: Ausencia de prevención contra solicitudes duplicadas y consumo indebido de correlativos
- **Ubicación:** `backend/src/domains/docucore/resoluciones.service.ts` (`proyectar` y `guardar`).
- **Causa Raíz:** No existía una validación que comprobase si el expediente ya disponía de una resolución activa en `sigd_doc.resolucion` antes de invocar `asignarNumeroAnual`. Como resultado, llamadas concurrentes o duplicadas asignaban un nuevo correlativo anual y persistían resoluciones duplicadas para el mismo trámite.
- **Corrección:**
  1. Se incorporó el método `obtenerPorExpedienteId` en la interfaz `RepositorioProyectoResolucion` y en su implementación canónica.
  2. En `servicio.proyectar`, se verifica si el expediente ya tiene una resolución en estado `BORRADOR_PENDIENTE_FIRMA`, `EN_FIRMA`, `FIRMADA` o `NOTIFICADA`. Si existe, se rechaza inmediatamente con `ConflictError` (HTTP 409, código `EXPEDIENTE_YA_TIENE_RESOLUCION`) antes de tocar la secuencia de correlativos.
  3. Dentro de la transacción atómica de `repositorio.guardar`, se añadió una verificación equivalente como mecanismo de defensa en profundidad contra condiciones de carrera.

### Defecto 3: Desconexión de navegación en la vista de detalle de expediente
- **Ubicación:** `frontend/src/pages/expedientes/ExpedienteDetallePage.tsx`.
- **Causa Raíz:** Cuando el expediente se encuentra en estado `EN_REVISION` en Secretaría Académica, la interfaz no ofrecía un acceso directo para proyectar la resolución en DocuCore.
- **Corrección:** Se agregó el botón condicional `Proyectar Resolución` que navega hacia `/flujos/proyector-resoluciones?expedienteId=<idExpediente>`, y en `ProyectorResolucionesPage.tsx` se integró la carga reactiva de los metadatos del expediente (CUT, administrado y asunto) para pre-llenar la plantilla A4 oficial.

---

## 3. ARCHIVOS INSPECCIONADOS Y MODIFICADOS

| Archivo | Tipo de Cambio | Justificación Arquitectónica |
| :--- | :--- | :--- |
| `backend/src/domains/docucore/resoluciones.service.ts` | Corrección técnica | Corrección del cálculo de correlativo consecutivo (`max_correlativo`) y validación de unicidad de resolución por expediente (`obtenerPorExpedienteId`). |
| `backend/tests/unit/domains/docucore/resoluciones.spec.ts` | Pruebas unitarias | Agregadas 5 pruebas de robustez: asignación consecutiva 8 $\rightarrow$ 9, rechazo de duplicados (409), 404 expediente inexistente, 403 RBAC por área y rollback transaccional ante fallos. |
| `frontend/src/pages/expedientes/ExpedienteDetallePage.tsx` | Integración UX | Botón "Proyectar Resolución" visible cuando el expediente está en estado `EN_REVISION`. |
| `frontend/src/pages/flujos/ProyectorResolucionesPage.tsx` | Integración UX | Carga reactiva de datos del expediente vía API para inicializar la plantilla de resolución. |
| `frontend/tests/unit/pages/ExpedienteRecepcionAction.test.tsx` | Pruebas unitarias | Validación del renderizado del botón "Proyectar Resolución" ante estado `EN_REVISION`. |

---

## 4. CONTRATO HTTP EFECTIVO Y PAYLOAD UTILIZADO

### Endpoint REST
`POST /api/v1/resoluciones/proyectar`

### Cabeceras HTTP
```http
POST /api/v1/resoluciones/proyectar HTTP/1.1
Host: 127.0.0.1:3008
Content-Type: application/json
Authorization: Bearer <TOKEN_JWT_OPERADOR_DEMO>
```

### Payload de la Solicitud
```json
{
  "expedienteId": "9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca",
  "tipoResolucion": "DIRECTORAL_ADMINISTRATIVA",
  "visto": "Expediente N° EXP-2026-000011 sobre solicitud de Derecho de Reincorporación (Reingreso) presentada por don Sergio Serruche.",
  "considerandos": [
    "Que, mediante solicitud registrada con CUT EXP-2026-000011, don Sergio Serruche solicita su reincorporación académica al Programa de Estudios de Desarrollo de Sistemas de Información para el periodo lectivo 2026-I.",
    "Que, la Secretaría Académica evaluó el cumplimiento de los requisitos conforme al procedimiento TUPA SUZ26-050 y emitió dictamen favorable para la reincorporación solicitada.",
    "Que, de conformidad con lo establecido en la Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior, y el Reglamento Institucional del IESTP Suiza."
  ],
  "articulos": [
    {
      "numero": 1,
      "texto": "APROBAR la reincorporación académica del estudiante don Sergio Serruche al Programa de Estudios de Desarrollo de Sistemas de Información para el periodo lectivo 2026-I."
    },
    {
      "numero": 2,
      "texto": "NOTIFICAR la presente resolución al administrado a través de su Casilla Electrónica institucional y remitir copia a Secretaría Académica y Unidad de Secretaría General."
    }
  ],
  "distribucion": [
    "Dirección General",
    "Secretaría Académica",
    "Unidad de Registro y Archivo",
    "Interesado"
  ]
}
```

### Respuesta HTTP 201 Created (Éxito Inicial)
```json
{
  "resolucionId": "a2c988cb-f5d5-4a0d-944d-e34451ce3be1",
  "numeroBorrador": "RD-2026-000009",
  "correlation_id": "624752ec-8d5b-40c6-8029-f35d325d3ac3"
}
```

### Respuesta HTTP 409 Conflict (Intento Duplicado / RFC 7807)
```json
{
  "type": "https://sigd.iestpsuiza.edu.pe/errors/expediente_ya_tiene_resolucion",
  "title": "Conflict",
  "status": 409,
  "detail": "El expediente ya cuenta con la resolución RD-2026-000009 en estado BORRADOR. Utilice la actualización de borrador para modificarla.",
  "instance": "/api/v1/resoluciones/proyectar",
  "code": "EXPEDIENTE_YA_TIENE_RESOLUCION",
  "codigo": "EXPEDIENTE_YA_TIENE_RESOLUCION",
  "correlation_id": "dc380292-4ad6-48f0-96fc-600b73ae8aaf",
  "correlationId": "dc380292-4ad6-48f0-96fc-600b73ae8aaf",
  "invalid_params": [],
  "invalidParams": [],
  "timestamp": "2026-10-27T21:26:00.359Z"
}
```

---

## 5. RESULTADOS DE PRUEBAS AUTOMATIZADAS Y TYPECHECKS

Se ejecutaron las suites de pruebas unitarias, regresiones y verificación estática sin suposiciones:

| Suite / Verificación | Pruebas Aprobadas | Omitidas | Fallidas | Estado |
| :--- | :---: | :---: | :---: | :---: |
| **DocuCore Resoluciones Unitarias** (`resoluciones.spec.ts`) | **21** | 0 | 0 | **APROBADO** |
| **Backend Vitest Global** (`vitest.unit.config.ts`) | **1204** | 10 | 0 | **APROBADO** |
| **Frontend Vitest Global** (`frontend/`) | **709** | 1 | 0 | **APROBADO** |
| **Backend Typecheck** (`tsc --noEmit`) | 0 errores | - | 0 | **APROBADO** |
| **Frontend Typecheck** (`tsc --noEmit`) | 0 errores | - | 0 | **APROBADO** |
| **Verificación de Estilo / Diff** (`git diff --check`) | 0 errores | - | 0 | **APROBADO** |

---

## 6. EVIDENCIA DE PERSISTENCIA Y TRAZABILIDAD

### A. Persistencia en PostgreSQL (`sigd_jacobo_demo`)
```sql
SELECT resolucion_id, expediente_id, numero_borrador, numero_resolucion, tipo_resolucion, estado, fecha_proyeccion, proyectado_por
FROM sigd_doc.resolucion WHERE resolucion_id = 'a2c988cb-f5d5-4a0d-944d-e34451ce3be1';
```
**Resultado persistido:**
- `resolucion_id`: `a2c988cb-f5d5-4a0d-944d-e34451ce3be1`
- `expediente_id`: `9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca`
- `numero_borrador`: `RD-2026-000009`
- `numero_resolucion`: `RD-2026-000009`
- `tipo_resolucion`: `DIRECTORAL_ADMINISTRATIVA`
- `estado`: `BORRADOR_PENDIENTE_FIRMA`
- `fecha_proyeccion`: `2026-10-27`
- `proyectado_por`: `00000000-0000-0000-0000-000000000030` (`operador.demo`)

### B. Bitácora de Auditoría Inmutable WORM (`sigd_audit.bitacora_auditoria`)
```sql
SELECT id_auditoria, tabla, operacion, esquema, fecha_hora, datos_despues->>'numero_resolucion' as numero
FROM sigd_audit.bitacora_auditoria WHERE tabla = 'resolucion' ORDER BY fecha_hora DESC LIMIT 1;
```
**Resultado:**
- `id_auditoria`: `d144a0c1-330c-4607-a3d1-e35a21ac17a5`
- `tabla`: `resolucion`
- `operacion`: `INSERT`
- `esquema`: `sigd_doc`
- `fecha_hora`: `2026-10-27 21:25:17.537838+00`
- `numero`: `RD-2026-000009`

### C. Almacenamiento Documental SILO / MinIO S3
```bash
docker exec sigd-minio-1 mc stat myminio/sigd-sandbox-e2e/resoluciones/borradores/a2c988cb-f5d5-4a0d-944d-e34451ce3be1.json
```
**Metadatos verificados:**
- Objeto: `resoluciones/borradores/a2c988cb-f5d5-4a0d-944d-e34451ce3be1.json`
- Tamaño: `5.9 KiB`
- Fecha: `2026-10-27 21:25:17 UTC`
- Content-Type: `application/json`
- Integridad: Documento normativo A4 con membrete institucional, vistos, considerandos, artículos resolutivos y distribución renderizada en HTML.

---

## 7. BALANCE DE CORRELATIVOS Y AISLAMIENTO INSTITUCIONAL

| Entidad / Métrica | Valor Previo | Valor Posterior | Delta / Efecto | Estado |
| :--- | :---: | :---: | :---: | :--- |
| **Resoluciones en BD** | 4 | 5 | +1 | Correlativo `RD-2026-000009` consumido válidamente |
| **Último correlativo resolución** | `RD-2026-000008` | `RD-2026-000009` | +1 | Secuencia estrictamente consecutiva sin saltos |
| **Siguiente correlativo disponible** | `RD-2026-000009` | `RD-2026-000010` | +1 | Listo para próximas proyecciones |
| **Asientos de Mesa de Partes** | 10010 | 10010 | 0 | Intacto, sin consumo indebido |
| **Radicaciones en TramiCore** | 11 | 11 | 0 | Intacto, sin consumo indebido |
| **Base protegida `sigd_prueba`** | 2 registros | 2 registros | 0 | **ZERO TOUCH ESTRICTO PRESERVADO** |

---

## 8. LÍMITES Y OPERACIONES NO EJECUTADAS EN ESTA FASE

Conforme a las restricciones obligatorias de la Fase 8, las siguientes operaciones no fueron ejecutadas y quedan preparadas para las fases siguientes:

1. **Firma Digital ReFirma:** No se invocó `/api/v1/firma/invocar-refirma` ni se interactuó con certificados criptográficos reales.
2. **Callbacks de Firma:** No se emitieron callbacks para mutar el estado a `FIRMADA`.
3. **Despacho a Casilla Electrónica:** No se realizaron envíos de notificaciones ciudadanas.
4. **Acuses Legales:** No se emitieron acuses legales de notificación.

---

## 9. DICTAMEN FINAL DE ACEPTACIÓN

La **Fase 8: Implementación, Integración y Prueba E2E de Proyección de Resoluciones en DocuCore** ha sido completada con éxito. La resolución `RD-2026-000009` se encuentra debidamente persistida en `sigd_doc.resolucion`, respaldada en MinIO S3 y auditada en `sigd_audit.bitacora_auditoria`. La suite automatizada cuenta con 1204 pruebas backend y 709 pruebas frontend aprobadas, 0 errores de compilación y estricto respeto a la inmutabilidad de la base protegida.

**Estado de la Fase:** **ACEPTADA Y CONCLUIDA SATISFACTORIAMENTE**.
