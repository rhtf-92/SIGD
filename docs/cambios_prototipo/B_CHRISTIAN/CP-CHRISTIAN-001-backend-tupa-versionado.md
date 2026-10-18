# CP-CHRISTIAN-001 — Implementación controlada del backend TUPA versionado

- **Responsable:** Christian Jhoel Rodríguez Cari (B_CHRISTIAN)
- **Base técnica de referencia:** Rama `B_GERIC` (commit `3b134602ab5de8317b6f620c86feb93e7c64ada7`)
- **Fecha de implementación:** 18 de octubre de 2026
- **Estado de entrega:** APORTE B_CHRISTIAN LISTO PARA REVISIÓN DE GERIC

---

## 1. Resumen Ejecutivo

Este cambio integra el flujo de procedimientos TUPA versionados (definido canónicamente por la tabla inmutable `sigd_doc.tupa_registro_version` y el vínculo relacional `sigd_doc.expediente_tupa_vinculo`, introducidos en la migración `08_sigd_tupa_acoplamiento.sql`) en el dominio de tramitación del SIGD (`TramiCore`).

Se respetan las restricciones arquitectónicas no negociables:
1. `sigd_tra.expediente.expediente_id` es un UUID estricto (string en TypeScript/JSON); no se emplean conversiones numéricas, casts `BIGINT ↔ UUID` ni identificadores ficticios.
2. La fuente canónica de trámites TUPA es `sigd_doc.tupa_registro_version`; el catálogo legado `sigd_doc.tipo_tramite_tupa` permanece expuesto de forma accesoria en `/api/v1/tramites/tipos` únicamente por compatibilidad hacia atrás.
3. Solo se publican procedimientos con `estado_validacion = 'APROBADO'` (actualmente 18 entradas aprobadas en el prototipo); se excluyen de la API pública los estados `PENDIENTE_VALIDACION`, `RECHAZADO` o no aprobados.
4. La clave primaria de selección es `registroVersionId` (UUID string), no códigos textuales ni índices de arreglos.
5. Se garantiza atomicidad transaccional: el expediente, el trámite, el asiento inmutable en el libro institucional y el vínculo TUPA se crean dentro de una misma transacción. Un fallo en el vínculo revierte la totalidad del registro sin dejar estados parciales ni expedientes huérfanos.
6. El flujo libre permanece plenamente operativo: si `registroVersionId` es omitido o nulo, el expediente se genera normalmente y la consulta posterior devuelve `tupa: null`.

---

## 2. Archivos Modificados y Creados

### Archivos Modificados:
1. `backend/src/domains/tramicore/tramites.schemas.ts`:
   - Incorporación de `registroVersionId` (`z.string().uuid().optional().nullable()`) en `radicacionVirtualSchema`.
   - Modificación de `idTipoTramiteTupa` a opcional y nullable para no forzar su presencia en radicaciones de flujo libre.
   - Modificación de `tipoDocumentalId` a opcional para admitir resolución por omisión hacia el tipo documental activo institucional si no se envía en cargas legadas.
   - Inclusión de `expedienteTupaParamsSchema` para validación canónica de UUIDs en rutas de consulta de expediente.
2. `backend/src/domains/tramicore/radicacionVirtual.service.ts`:
   - Validación integral de `registroVersionId`: formato UUID, existencia en `sigd_doc.tupa_registro_version`, estado `'APROBADO'` y verificación de vigencia temporal.
   - Creación atómica del vínculo en `sigd_doc.expediente_tupa_vinculo` dentro de la transacción del expediente.
   - Conservación del flujo libre cuando `registroVersionId` es ausente/nulo.
   - Implementación del método de consulta `obtenerDetalleExpediente(expedienteId: string)` con proyección de metadatos del expediente y contexto TUPA de solo lectura.
3. `backend/src/domains/tramicore/ventanillaPresencial.service.ts`:
   - Soporte opcional de `registroVersionId` en la recepción física en ventanilla presencial.
   - Validación de la versión TUPA y creación del vínculo relacional dentro de la misma transacción física.
   - Conservación del método estático de compatibilidad para pruebas unitarias previas.
4. `backend/src/domains/tramicore/tramites.controller.ts`:
   - Reemplazo de la ruta canónica `GET /api/v1/tramites/tupa` para publicar el catálogo versionado mediante `TupaVersionadoService`.
   - Conservación de `GET /api/v1/tramites/tipos` con el catálogo legado.
   - Exposición de endpoints de lectura: `GET /api/v1/tramites/expedientes/:expedienteId` (detalle completo) y `GET /api/v1/tramites/expedientes/:expedienteId/tupa` (contexto TUPA).

### Archivos Creados:
1. `backend/src/domains/tramicore/tupaVersionado.service.ts`:
   - Servicio del catálogo TUPA versionado: `listarAprobados()`, `validarYObtenerVersion()` y `obtenerContextoExpediente()`.
2. `backend/tests/integration/domains/tramicore/tupa-versionado.test.ts`:
   - Suite de integración sobre base de datos descartable en PostgreSQL 18 local, cubriendo los 13 requerimientos mínimos del DoD.
3. `backend/tests/unit/domains/tramicore/tupaVersionado.spec.ts`:
   - Suite unitaria de `TupaVersionadoService` aislando validaciones de formato, existencia, estados y vigencia.
4. `backend/vitest.tupa-christian.config.ts`:
   - Configuración de Vitest para la ejecución aislada de las pruebas de integración de TUPA.
5. `docs/cambios_prototipo/B_CHRISTIAN/CP-CHRISTIAN-001-backend-tupa-versionado.md`:
   - La presente bitácora técnica de cambios.

---

## 3. Endpoints y Contrato DTO

### 3.1. Catálogo TUPA Versionado
- **Ruta:** `GET /api/v1/tramites/tupa`
- **Fuente física:** `sigd_doc.tupa_registro_version WHERE estado_validacion = 'APROBADO'`
- **Estructura del DTO (`DtoRegistroTupaVersionado`):**
```json
[
  {
    "registroVersionId": "d3b07384-d113-4a11-8911-53b07384d113",
    "codigoExterno": "TUPA-2026-001",
    "codigo": "TUPA-2026-001",
    "denominacion": "Emisión de Certificado de Estudios Oficial",
    "monto": "25.00",
    "requisitos": [
      "Solicitud dirigida al Director General",
      "Comprobante de pago por derecho de trámite"
    ],
    "fuente": {
      "nombre": "TUPA-IESTP-SUIZA-2026.pdf",
      "documentoSha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "pagina": 14,
      "referenciaFila": "Fila-1"
    },
    "pagina": 14,
    "revision": 1,
    "vigencia": {
      "desde": "2026-01-01",
      "hasta": "2026-12-31"
    },
    "vigenciaDesde": "2026-01-01",
    "vigenciaHasta": "2026-12-31",
    "version": {
      "etiqueta": "2026-v1.0",
      "revision": 1,
      "vigenciaDesde": "2026-01-01",
      "vigenciaHasta": "2026-12-31"
    },
    "estadoValidacion": "APROBADO",
    "estado": "APROBADO",
    "referenciaAprobacion": "RD N° 045-2026-GR-UCAYALI-DRE",
    "id": "d3b07384-d113-4a11-8911-53b07384d113",
    "id_tipo_tramite": "d3b07384-d113-4a11-8911-53b07384d113"
  }
]
```

### 3.2. Radicación Virtual (Mesa de Partes Virtual)
- **Ruta:** `POST /api/v1/tramites/radicacion-virtual` (y alias `/api/v1/tramite/radicacion`)
- **Payload (`RadicacionVirtualInput`):**
  - `asunto` (string, 10–500 caracteres).
  - `idPersona` (UUID string, referencia a `sigd_auth.persona.id_persona`).
  - `tipoDocumentalId` (UUID string opcional; si se omite, se usa el tipo documental activo institucional).
  - `registroVersionId` (UUID string opcional; obligatorio si se selecciona TUPA, nulo o ausente en flujo libre).
  - `idTipoTramiteTupa` (UUID string opcional; legado).
  - `nombreSolicitante` (string, 2–120 caracteres).
  - `correo` (email válido).
  - `totalFolios` (entero positivo 1–5000).
  - `documentos` (arreglo de 1 a 30 adjuntos con `nombreArchivo`, `contentType`, `tamanoBytes`, `hashSha256`).
- **Respuesta (HTTP 201 Created):**
```json
{
  "expedienteId": "9a01f782-b7b5-4fa7-bfb8-2a21034d6189",
  "cut": "EXP-2026-000001",
  "anioFiscal": 2026,
  "fechaEnvioReal": "2026-10-18T20:30:00.000Z",
  "fechaRadicacionLegal": "2026-10-19T13:00:00.000Z",
  "diferidoPorCorte": true,
  "totalFolios": 3,
  "registroVersionId": "d3b07384-d113-4a11-8911-53b07384d113",
  "qrSeguimientoUrl": "SIGD://cargo/CARGO-A1B2C3D4?h=4a5b6c...",
  "cargoDigital": {
    "codigo": "CARGO-A1B2C3D4",
    "hashSha256": "4a5b6c...",
    "qrContenido": "SIGD://cargo/CARGO-A1B2C3D4?h=4a5b6c..."
  },
  "mensajeLegal": "Recibido despues del corte de las 16:30. Por Art. 138 de la LPAG el computo de plazos comienza el 2026-10-19 a las 08:00."
}
```

### 3.3. Consulta de Detalle de Expediente con Contexto TUPA
- **Rutas:**
  - `GET /api/v1/tramites/expedientes/:expedienteId`
  - `GET /api/v1/tramites/expedientes/:expedienteId/tupa`
- **Respuesta con TUPA vinculado:**
```json
{
  "expedienteId": "9a01f782-b7b5-4fa7-bfb8-2a21034d6189",
  "cut": "EXP-2026-000001",
  "codigoExpediente": "EXP-2026-000001",
  "numero": "EXP-2026-000001",
  "asunto": "Solicitud de emisión de constancia de egresado 2026",
  "dniSolicitante": "45872315",
  "solicitanteId": "f7829a01-b7b5-4fa7-bfb8-2a21034d6189",
  "tipoDocumentalId": "b8bfb7b5-9a01-4fa7-bfb8-2a21034d6189",
  "areaDestinoId": null,
  "estado": "REGISTRADO",
  "fechaRadicacion": "2026-10-18T20:30:00.000Z",
  "canalIngreso": "MESA_VIRTUAL",
  "tupa": {
    "registroVersionId": "d3b07384-d113-4a11-8911-53b07384d113",
    "codigoExterno": "TUPA-2026-001",
    "codigo": "TUPA-2026-001",
    "denominacion": "Emisión de Certificado de Estudios Oficial",
    "monto": "25.00",
    "requisitos": [
      "Solicitud dirigida al Director General",
      "Comprobante de pago por derecho de trámite"
    ],
    "fuente": "TUPA-IESTP-SUIZA-2026.pdf",
    "pagina": 14,
    "revision": 1,
    "version": "2026-v1.0",
    "estadoValidacion": "APROBADO",
    "vinculadoEn": "2026-10-18T20:30:01.000Z"
  }
}
```
- **Respuesta en Flujo Libre (sin TUPA):**
```json
{
  "expedienteId": "...",
  "cut": "EXP-2026-000002",
  "asunto": "Trámite institucional libre",
  "tupa": null
}
```

---

## 4. Validaciones de Negocio y Errores (RFC 7807)

Cuando se envía `registroVersionId`:
1. **Formato UUID:** Si no cumple el formato canónico UUID (por ejemplo, números enteros o textos corruptos), el esquema Zod o el servicio arroja `ValidationError` → **HTTP 400 Bad Request**.
2. **Existencia del Registro:** Si el UUID tiene formato válido pero no existe en `sigd_doc.tupa_registro_version`, se arroja `NotFoundError` → **HTTP 404 Not Found**.
3. **Estado de Aprobación:** Si el registro existe pero su estado es `PENDIENTE_VALIDACION` o `RECHAZADO`, se arroja `ConflictError` con código `VERSION_TUPA_NO_APROBADA` → **HTTP 409 Conflict**. Además, el trigger PL/pgSQL de la BD `sigd_doc.fn_tupa_vinculo_validar()` rechaza de forma inmutable cualquier inserción que no tenga `estado_validacion = 'APROBADO'`.
4. **Vigencia Temporal:** Si el registro tiene `vigencia_desde` posterior a la fecha actual o `vigencia_hasta` anterior, se arroja `ConflictError` con código `VERSION_TUPA_FUERA_DE_VIGENCIA` → **HTTP 409 Conflict**.
5. **No se devuelve HTTP 500** para ningún error previsible de validación o negocio. Todos los rechazos se formatean bajo la especificación RFC 7807 (`application/problem+json`) mediante el `errorMiddleware` de la plataforma.

---

## 5. Garantía de Atomicidad Transaccional

El registro completo se ejecuta en una única transacción de base de datos (`BEGIN ... COMMIT / ROLLBACK`):
1. Validación de persona en padrón.
2. Validación de tipo documental activo.
3. Validación de versión TUPA aprobada y vigente (si aplica).
4. Generación correlativa de CUT universal.
5. Inserción de cabecera en `sigd_tra.expediente`.
6. Inserción en `sigd_tra.tramite` (para visibilidad en bandeja RutaDoc).
7. Inserción en `sigd_tra.asiento_registro` (libro de registro inmutable).
8. Inserción en `sigd_doc.expediente_tupa_vinculo` (solo si `registroVersionId` fue provisto).
9. Emisión del cargo digital.

Cualquier excepción en cualquier paso desencadena un `ROLLBACK` total. Las pruebas comprueban que un UUID inexistente o un TUPA no aprobado no incrementan la tabla de expedientes ni dejan registros huérfanos.

---

## 6. Resultados de Pruebas

### 6.1. Pruebas Unitarias
- Comando: `npm run test:unit`
- **Resultado:** **31 suites pasadas, 544 pruebas pasadas, 0 fallidas** (9 omitidas correspondientes a outbox con workers externos).

### 6.2. Pruebas de Integración sobre PostgreSQL 18 Descartable
- Comando: `npx vitest run --config vitest.tupa-christian.config.ts --configLoader runner`
- **Resultado:** **13/13 PASS (100 % de éxito)**.
- Casos verificados:
  1. Catálogo devuelve solo APROBADO (18 entradas verificadas).
  2. PENDIENTE_VALIDACION y RECHAZADO no aparecen en el catálogo.
  3. registroVersionId es UUID canónico en todas las filas.
  4. TUPA válido permite radicación virtual exitosa (HTTP 201).
  5. Se crea expediente_tupa_vinculo con claves reales.
  6. UUID inexistente no crea expediente parcial (HTTP 404 y rollback total verificado).
  7. TUPA no aprobado se rechaza con error de negocio (HTTP 409).
  8. Flujo libre sigue funcionando y no crea vínculo.
  9. Detalle con TUPA devuelve contexto TUPA poblado.
  10. Detalle sin TUPA devuelve `tupa: null` sin error.
  11. CUT sigue siendo CUT con máscara canónica `EXP-YYYY-XXXXXX`.
  12. No se convierte UUID a número (rechazo 400).
  13. No se rompen rutas existentes (`/tipos`, alias `/tramite/radicacion`, ventanilla presencial).

### 6.3. Verificación de Integridad de Código
- `npm run typecheck`: **PASS (código 0, sin errores TypeScript)**.
- `npm run build`: **PASS (código 0, compilación limpia)**.
- `git diff --check`: **PASS (código 0, sin espacios en blanco residuales ni conflictos de formato)**.

---

## 7. Limitaciones y Decisiones Tomadas

1. **Minimización de Superficie de Cambio:** No se modificaron migraciones históricas `01` a `08`, no se modificó `BASELINE_2026_V1.sql`, no se tocó `migrate.ts`, ni `Dockerfile`, ni `docker-compose.yml`, ni el dominio ajeno `rutadoc`, ni `calendarizacion.service.ts`.
2. **Esquema de la Tabla de Vínculo:** La migración física `08_sigd_tupa_acoplamiento.sql` crea la tabla como `sigd_doc.expediente_tupa_vinculo` con FK a `sigd_tra.expediente(expediente_id)`. Se respetó rigurosamente esta ubicación canónica del DDL 08.
3. **Compatibilidad hacia atrás con el Frontend:** El DTO de salida incluye tanto `registroVersionId` y `codigoExterno` como los alias de compatibilidad `codigo`, `id` e `id_tipo_tramite` para garantizar interoperabilidad inmediata con las vistas existentes.
4. **Base de Datos Descartable:** Conforme a la regla de no ensuciar la base de datos compartida, la suite de integración crea dinámicamente una base de datos efímera (`sigd_test_tupa_*`), aplica las migraciones requeridas y la destruye al finalizar los ensayos.
