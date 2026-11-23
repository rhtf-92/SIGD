# SIGD IESTP SUIZA 2026 — INFORME DE PREAUDITORÍA FINAL Y PREPARACIÓN SEGURA DE LA PRUEBA E2E PRESENCIAL

**Fecha de emisión:** 27 de octubre de 2026  
**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD) — IESTP Suiza 2026  
**Rama de trabajo:** `B_JACOBO`  
**HEAD de referencia verificado:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`  
**Repositorio:** `C:\Users\Liz\Desktop\SIGD\SIGD`  
**Clasificación técnica:** Auditoría de solo lectura, análisis forense de contratos e ingeniería de pruebas E2E (ZERO-WRITE en DB).

---

## 1. RESUMEN EJECUTIVO

El presente informe consolida los hallazgos de la preauditoría técnica exhaustiva realizada sobre el prototipo SIGD IESTP Suiza 2026 en la rama `B_JACOBO`, orientada a cerrar todas las discrepancias previas y preparar un protocolo de prueba End-to-End (E2E) para la **Ventanilla Presencial** (`POST /api/v1/tramites/ventanilla-presencial`).

### Principales conclusiones forenses:
1. **Entorno y Puertos Reales:** Se demostró mediante inspección de procesos y del orquestador local (`scratch/serve_demo.ts` y `scripts/iniciar-sigd-local.ps1`) que el entorno de demostración desacoplado utiliza el puerto **`3008`** para el backend Node.js Express y el puerto **`5178`** para la SPA frontend Vite/React (evitando colisiones en 3000/5173). La base de datos efectiva es **`sigd_jacobo_demo`** servida en `127.0.0.1:5433` por el contenedor Docker `sigd-postgres-1`, con el usuario técnico de privilegios acotados `sigd_jacobo_user`. La base institucional `sigd_prueba` permanece completamente aislada e intacta.
2. **Contrato Real de la API:** Se descubrió y demostró una discrepancia crítica en los documentos anteriores: el endpoint de Ventanilla Presencial **no acepta archivos adjuntos (`anexos`), ni hashes SHA-256 de archivos, ni URLs S3, ni el objeto anidado `administrado`**. La Ventanilla Presencial modela la recepción física de expedientes en mostrador; su esquema Zod estricto (`.strict()`) exige datos planos del solicitante (`tipoPersona`, `tipoDocumento`, `dniSolicitante`, `nombres`, `apellidos`, `correo`, `telefono`), `asunto`, `foliosTotales`, `tipoDocumentalId` (UUID) y opcionalmente `idTipoTramiteTupa` (UUID). El envío de la estructura anterior hubiese sido rechazado de inmediato con error HTTP 400.
3. **Catálogo TUPA y Tipos Documentales para `SUZ26-050`:** La inspección directa de PostgreSQL determinó que:
   - El código `SUZ26-050` corresponde a **"Derecho de Reincorporación (Reingreso)"** (UUID `65950f60-be67-42c7-8a76-8bb0698f7868`).
   - El procedimiento "Certificado de Estudios Superiores" corresponde en realidad al código `SUZ26-035` (UUID `3443d0c0-ebaf-48d2-a4d0-2c32ec1fc6dd`).
   - El UUID `b7f37bde-ec45-49d0-b28e-fc2ad4341b60` corresponde exclusivamente al tipo documental canónico **`COMPROBANTE_PAGO`**, el cual es el **único** tipo admitido en `sigd_doc.tipo_documento_requisito` para `SUZ26-050`.
   - El documento `FUT` (UUID `dc156983-a824-418a-835e-5a7e104c9ca5`) **no está mapeado** a `SUZ26-050`. De haberse enviado `FUT` como `tipoDocumentalId`, el backend habría abortado la transacción con error 400 antes de generar el CUT.
4. **Integridad de Correlativos:** Mediante consultas estrictas de solo lectura, se ratificó que `secuencia_anual_cut` se mantiene inalterada en `ultimo_correlativo = 10` (próximo CUT: `EXP-2026-000011`) y la secuencia de asientos `seq_asiento_numero_registro` se mantiene en `last_value = 10009` (próximo asiento: `10010`). Existen 10 expedientes en TramiCore, 10 en DocuCore (coincidencia de 100% en UUIDs), y 9 asientos registrales (todos de origen `MESA_VIRTUAL`, 0 huérfanos).
5. **Estado de Pruebas:** Se ejecutaron con éxito 150 pruebas unitarias de TramiCore (148 pasadas, 2 skipped, 0 fallos), 23 pruebas de RBAC institucional (23 pasadas, 0 fallos) y 48 pruebas de integración y enrutamiento frontend de Ventanilla Presencial (48 pasadas, 0 fallos). Los typechecks de backend y frontend arrojaron **0 errores**.
6. **Protección Estricta:** No se ejecutó ningún `POST` transaccional ni llamada a secuencias en PostgreSQL; la base de datos permanece intacta a la espera de autorización expresa.

---

## 2. ESTADO INICIAL Y FINAL DE GIT

- **Rama:** `B_JACOBO` (alineada con `origin/B_JACOBO`).
- **Commit HEAD:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`.
- **Inventario de Modificaciones:** Se identificaron y preservaron intactos los **154 archivos de código modificados** correspondientes al trabajo acumulado de Codex y Antigravity.
- **Higiene de Diff:** Se verificó la ausencia de conflictos y de espacios en blanco espurios (`git diff --check` retornó código de salida 0).
- **Operaciones no realizadas:** No se realizaron `git reset`, `git clean`, `git restore`, `git stash`, ni cambios de rama. No se realizó ningún commit ni push.

---

## 3. ENTORNO Y BASE DE DATOS EFECTIVAMENTE COMPROBADOS

A través del análisis del archivo de ejecución `scratch/serve_demo.ts`, el script de arranque `scripts/iniciar-sigd-local.ps1` y las inspecciones de red y Docker, se determinó el mapa exacto del entorno del prototipo:

### 3.1. Tabla de Componentes, Direcciones y Puertos Efectivos

| Componente | Contenedor / Proceso | Puerto Host Publicado | URL / Cadena Efectiva | Identidad / Estado |
| :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL Prototipo** | `sigd-postgres-1` (Docker) | `127.0.0.1:5433` (mapeado a 5432 interno) | `postgresql://127.0.0.1:5433/sigd_jacobo_demo` | `sigd_jacobo_demo` (User: `sigd_jacobo_user`, rol no administrativo) |
| **PostgreSQL Institucional** | Servicio Local Host (PID 6852) | `127.0.0.1:5432` / `::1:5432` | `postgresql://127.0.0.1:5432/sigd_prueba` | **100% AISLADA / PROTEGIDA** |
| **Redis Cache / Sesiones** | `sigd-redis-1` (Docker) | `127.0.0.1:6379` | `redis://127.0.0.1:6379/1` | DB índice 1 (estado healthy, `PONG`) |
| **MinIO (S3 API)** | `sigd-minio-1` (Docker) | `127.0.0.1:9000` | `http://127.0.0.1:9000` | Bucket verificado: `sigd-sandbox-e2e` |
| **MinIO Web Console** | `sigd-minio-1` (Docker) | `127.0.0.1:9001` | `http://127.0.0.1:9001` | Consola administrativa S3 (healthy) |
| **Backend Express SIGD** | Node.js (v24.19.0 via tsx) | `127.0.0.1:3008` | `http://127.0.0.1:3008/api/v1` | Monitoreo: `/health` y `/ready` (200 OK) |
| **Frontend React SPA** | Vite 6 dev server | `127.0.0.1:5178` | `http://127.0.0.1:5178/` | `VITE_API_BASE_URL: http://127.0.0.1:3008` |

> [!IMPORTANT]
> **Aclaración sobre Puertos y Buckets:** Los puertos `3000` y `5173` citados en esquemas Docker genéricos corresponden a plantillas por defecto. El entorno real de ejecución local del prototipo `B_JACOBO` vincula estrictamente el backend al puerto **`3008`** y el frontend al puerto **`5178`**, y utiliza el bucket **`sigd-sandbox-e2e`** en MinIO, evitando cualquier colisión de puertos o sobreescritura con la base institucional `sigd_prueba`.

### 3.2. Verificación Forense de PostgreSQL de Solo Lectura
Mediante consulta con privilegios de solo lectura sobre `sigd-postgres-1`:
- `current_database()`: `sigd_jacobo_demo`
- `current_user`: `sigd_jacobo_user`
- `pg_roles`: `rolsuper = false`, `rolcreatedb = false`, `rolcreaterole = false`
- Esquemas disponibles: `sigd_tra`, `sigd_rut`, `sigd_org`, `sigd_doc`, `sigd_auth`, `sigd_audit`.

---

## 4. AUDITORÍA DEL CONTRATO REAL DE VENTANILLA PRESENCIAL

### 4.1. Código y Esquemas Analizados
- `backend/src/domains/tramicore/tramites.schemas.ts`
- `backend/src/domains/tramicore/tramites.controller.ts` (L14-L21, L84-L90)
- `backend/src/domains/tramicore/ventanillaPresencial.service.ts` (L20-L39, L62-L153)
- `frontend/src/pages/tramite/VentanillaPresencialPage.tsx` (L170-L185)

### 4.2. Definición Exacta del Contrato (`ventanillaPresencialSchema`)
El esquema de validación implementado en el backend está definido con restricción estricta (`.strict()`):

```typescript
export const ventanillaPresencialSchema = z.object({
  tipoPersona: z.literal('NATURAL'),
  tipoDocumento: z.literal('DNI'),
  dniSolicitante: z.string().refine((dni) => validarDni(dni).valido, 'El DNI debe contener exactamente 8 dígitos.'),
  nombres: z.string().trim().min(1, 'Indique los nombres.').max(120),
  apellidos: z.string().trim().min(1, 'Indique los apellidos.').max(120),
  correo: z.string().trim().email().max(160).optional(),
  telefono: z.string().trim().min(1).max(20).optional(),
  asunto: z.string().min(5).max(500),
  foliosTotales: z.coerce.number().int().positive(),
  areaDestinoId: z.string().uuid().optional(),
  tipoDocumentalId: z.string().uuid().optional(),
  idTipoTramiteTupa: radicacionVirtualSchema.innerType().shape.idTipoTramiteTupa.optional(),
}).strict();
```

### 4.3. Desglose de Parámetros del Contrato

| Campo | Tipo / Validación | Obligatoriedad | Descripción / Regla de Negocio |
| :--- | :--- | :---: | :--- |
| `tipoPersona` | `literal('NATURAL')` | **Obligatorio** | La ventanilla presencial en esta versión atiende a personas naturales. |
| `tipoDocumento` | `literal('DNI')` | **Obligatorio** | Tipo de documento de identidad admitido. |
| `dniSolicitante` | `string` (8 dígitos numéricos) | **Obligatorio** | Validado mediante módulo 11 (`validarDni`). |
| `nombres` | `string` (1 - 120 caracteres) | **Obligatorio** | Nombres del administrado en mostrador. |
| `apellidos` | `string` (1 - 120 caracteres) | **Obligatorio** | Apellidos paterno y materno del administrado. |
| `correo` | `string` email (máx 160) | *Opcional* | Correo de contacto para notificaciones secundarias. |
| `telefono` | `string` (1 - 20 caracteres) | *Opcional* | Teléfono celular de contacto. |
| `asunto` | `string` (5 - 500 caracteres) | **Obligatorio** | Descripción o sumilla del trámite presencial. |
| `foliosTotales` | `number` entero positivo (> 0) | **Obligatorio** | Cantidad de fojas físicas entregadas en el mostrador. |
| `tipoDocumentalId` | `string` UUID v4 | **Obligatorio en servicio** | Identificador del tipo documental presentado (debe existir y estar vigente en `sigd_doc.tipo_documento`). |
| `idTipoTramiteTupa` | `string` UUID v4 | *Opcional* | Procedimiento TUPA asociado (debe existir y estar vigente en `sigd_doc.tipo_tramite_tupa`). |
| `areaDestinoId` | `string` UUID v4 | *Opcional* | Área institucional destinataria si se especifica directamente. |

### 4.4. Reglas Críticas de Rechazo Previo al CUT
El servicio transaccional ejecuta las siguientes validaciones **antes de invocar `sigd_tra.generar_cut_expediente`** (evitando el consumo accidental de secuencias en caso de error):
1. **Validación Zod estricta:** Si se transmiten campos desconocidos (`administrado`, `anexos`, `procedimiento_tupa_id`, etc.), Zod rechaza la solicitud de inmediato con error `400 Bad Request` (`unrecognized_keys`).
2. **Existencia y Vigencia del Tipo Documental:** Se comprueba que `tipoDocumentalId` exista en `sigd_doc.tipo_documento` con `vigente = TRUE`.
3. **Compatibilidad TUPA - Tipo Documental:** Si se proporciona `idTipoTramiteTupa`, se verifica que el procedimiento exista, esté vigente y que `tipoDocumentalId` esté registrado en `sigd_doc.tipo_documento_requisito` para dicho trámite.
4. **Coherencia de Prefijo en Asunto:** Si el asunto incluye un prefijo del tipo `SUZ26-XXX —`, el código debe coincidir exactamente con el procedimiento indicado en `idTipoTramiteTupa`.
5. **Autenticación y Autorización RBAC:** La solicitud requiere una cabecera `Authorization: Bearer <JWT>` válida, y la cuenta del operador debe poseer el rol institucional `MESA_PARTES` activo y no caducado en `sigd_org.usuario_rol`.

---

## 5. MATRIZ DE REQUISITOS Y TIPOS DOCUMENTALES (CASO SUZ26-050)

### 5.1. Identificación del Procedimiento en Catálogo
La consulta a `sigd_doc.tipo_tramite_tupa` arrojó:
- **Código:** `SUZ26-050`
- **UUID:** `65950f60-be67-42c7-8a76-8bb0698f7868`
- **Denominación oficial:** `Derecho de Reincorporación (Reingreso)`
- **Vigencia:** `true`

*(Nota técnica: El procedimiento "Certificado de Estudios Superiores" está registrado bajo el código `SUZ26-035` con UUID `3443d0c0-ebaf-48d2-a4d0-2c32ec1fc6dd`).*

### 5.2. Mapeo de Tipos Documentales para `SUZ26-050`

| Archivo Documental | Tipo Canónico | UUID Real en Catálogo | ¿Admitido por SUZ26-050 en `tipo_documento_requisito`? |
| :--- | :--- | :--- | :---: |
| **Comprobante de Pago** | `COMPROBANTE_PAGO` | `b7f37bde-ec45-49d0-b28e-fc2ad4341b60` | **SÍ** (`tipo_documental_permitido = true`) |
| **FUT (Formulario Único)** | `FUT` | `dc156983-a824-418a-835e-5a7e104c9ca5` | **NO** (No asociado en el catálogo DDL para SUZ26-050) |

> [!WARNING]
> **Causa de Rechazo Evitada:** En el catálogo del DDL institucional, para el procedimiento `SUZ26-050` el único tipo documental registrado en `sigd_doc.tipo_documento_requisito` es `COMPROBANTE_PAGO` (`b7f37bde-ec45-49d0-b28e-fc2ad4341b60`). Si una prueba intentara registrar `SUZ26-050` indicando como `tipoDocumentalId` el UUID del `FUT`, el servicio lo rechazaría con `ValidationError: El procedimiento no existe, no está vigente o contradice la solicitud.`

---

## 6. DIAGNÓSTICO DE INCONSISTENCIAS DEL PAYLOAD ANTERIOR

Se identificaron tres anomalías estructurales graves en el borrador de payload formulado en sesiones previas:

1. **Estructura Híbrida Equivocada (Ventanilla Presencial vs Mesa Virtual):**
   - El payload previo incluía objetos anidados `administrado: { ... }` y un arreglo `anexos: [ ... ]`.
   - **Diagnóstico:** Esta estructura pertenece exclusivamente a la Mesa de Partes Virtual (`POST /api/v1/tramites/radicacion-virtual`). La Ventanilla Presencial no tiene almacenamiento S3 en línea de archivos adjuntos en el momento del registro; recibe documentos impresos en mesa, registrando la fojación total (`foliosTotales`) y emitiendo un ticket térmico con cargo y código QR.
2. **Hash SHA-256 Sintético de Contenido Vacío:**
   - El hash `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` corresponde a una cadena de 0 bytes (`sha256("")`).
   - **Diagnóstico:** En Ventanilla Presencial, el cliente **no envía un hash de archivo**. El hash del cargo es generado automáticamente por el backend a nivel criptográfico combinando los datos inmutables de la recepción:
     $$\text{hashSha256} = \text{SHA-256}(CUT \parallel fechaIso \parallel DNI \parallel remitente \parallel asunto \parallel folios)$$
3. **URL Ficticia S3:**
   - La referencia `s3://tramites/2026/presencial/fut_firmado.pdf` no existe ni es compatible con la API de MinIO ni con el esquema Zod de Ventanilla Presencial.

### 6.3. Payload Real Corregido Conforme al Código y al Catálogo
El siguiente es el payload exacto, 100% compatible con `ventanillaPresencialSchema` y con el catálogo de `sigd_jacobo_demo`:

```json
{
  "tipoPersona": "NATURAL",
  "tipoDocumento": "DNI",
  "dniSolicitante": "44556677",
  "nombres": "CARLOS ALBERTO",
  "apellidos": "MENDOZA RUIZ",
  "correo": "carlos.mendoza@test.suiza.edu.pe",
  "telefono": "961234567",
  "asunto": "SUZ26-050 — Derecho de Reincorporación (Reingreso) - Solicitud de reincorporación periodo 2026-I",
  "foliosTotales": 4,
  "tipoDocumentalId": "b7f37bde-ec45-49d0-b28e-fc2ad4341b60",
  "idTipoTramiteTupa": "65950f60-be67-42c7-8a76-8bb0698f7868"
}
```

- **Campos confirmados por el código:** Todos los 10 campos coinciden con las propiedades de `ventanillaPresencialSchema`.
- **Valores confirmados por PostgreSQL:** `b7f37bde-ec45-49d0-b28e-fc2ad4341b60` (`COMPROBANTE_PAGO`) y `65950f60-be67-42c7-8a76-8bb0698f7868` (`SUZ26-050`) verificados activos y compatibles en la base de datos.
- **Datos de prueba del solicitante:** DNI `44556677` y nombres de administrado son valores de prueba válidos según módulo 11.

---

## 7. AUDITORÍA DE IDENTIDAD Y ESTADO DE RBAC

Se verificó el operador de demostración y sus facultades institucionales mediante consultas directas de solo lectura sobre `sigd_auth` y `sigd_org`:

1. **Cuenta de Usuario (`sigd_auth.cuenta_usuario`):**
   - `id_usuario`: `00000000-0000-0000-0000-000000000040`
   - `usuario`: `ventanilla.demo`
   - `correo`: `ventanilla.demo@sandbox.invalid`
   - `activo`: `true`
   - Sujeto vinculado: `Téc. Operador Ventanilla Demo` en `sigd_auth.persona_natural`.
2. **Rol Institucional Activo (`sigd_org.usuario_rol` / `sigd_org.rol_sistema`):**
   - Rol asignado: `MESA_PARTES` (`vigente = true`).
   - Vigencia: Desde inicio de año fiscal, sin límite de expiración (`vigente_hasta IS NULL`).
   - Área vinculada: `a1a3a496-ff7f-45d8-b63c-3e54fcf79de1` (`Mesa de Partes`, nivel 1, path `a.MP`).
3. **Facultades Efectivas Evaluadas por Middleware:**
   - Consulta `obtenerAutorizacionCuenta`:
     - `roles`: `["MESA_PARTES"]`
     - `permisos`: `EXPEDIENTE_DERIVAR` (ámbito AREA), `EXPEDIENTE_LEER` (ámbito GLOBAL)
     - `unidad_organica_id`: `a1a3a496-ff7f-45d8-b63c-3e54fcf79de1`
   - **Conclusión de RBAC:** El operador `ventanilla.demo` cuenta con las facultades activas requeridas para superar `exigirOperadorVentanilla` sin impedimentos.

---

## 8. CONCILIACIÓN DE CORRELATIVOS EN POSTGRESQL (SOLO LECTURA)

Se efectuaron consultas forenses sobre `sigd_jacobo_demo` sin emitir instrucciones DML ni llamadas de secuencias:

```sql
-- Estado de correlativo anual
SELECT anio_fiscal, ultimo_correlativo, creado_en FROM sigd_tra.secuencia_anual_cut;
-- Resultado: anio_fiscal = 2026 | ultimo_correlativo = 10

-- Estado de secuencia de asientos
SELECT last_value, is_called FROM sigd_tra.seq_asiento_numero_registro;
-- Resultado: last_value = 10009 | is_called = true
```

### 8.1. Próximos Correlativos Predichos (Sin consumir)
- Próximo CUT que se generaría: **`EXP-2026-000011`**.
- Próximo Asiento registral que se generaría: **`10010`**.

### 8.2. Censo e Integridad Cruzada de Datos
- **Expedientes en TramiCore (`sigd_tra.expediente`):** 10 filas.
- **Expedientes en DocuCore (`sigd_doc.expediente`):** 10 filas.
- **Asientos Registrales (`sigd_tra.asiento_registro`):** 9 filas.
- **Integridad referencial:**
  - Asientos huérfanos: **0**
  - Desconexión TramiCore $\leftrightarrow$ DocuCore: **0** (10 de 10 coinciden en UUID y CUT).
  - CUTs duplicados: **0**
  - Asientos duplicados: **0**
- **Naturaleza de los registros:** Los 9 asientos existentes son todos de canal `MESA_VIRTUAL` (`10001` a `10009`). El prototipo **no cuenta aún con ningún asiento de canal `MESA_PRESENCIAL`**, lo que garantiza que la prueba E2E será el primer registro formal presencial de la base de datos.
- **Expediente `EXP-2026-000142`:** Es una Resolución Directoral interna institucional (`RD-0142-2026`), que por disposición de la LPAG nace en DocuCore sin pasar por el Libro de Entradas de Ventanilla externa.

---

## 9. RESULTADOS DE PRUEBAS AUTOMATIZADAS EJECUTADAS

Se corrieron las suites pertinentes para validar el contrato, las reglas TUPA, el RBAC y la integración frontend:

### 9.1. Backend (`vitest run`)
- **Suite TramiCore (`tests/unit/domains/tramicore/`):**
  - Archivos: 10 suites evaluadas, **10 pasadas (100%)**.
  - Pruebas: **148 pruebas aprobadas**, 2 omitidas, **0 fallos**.
  - Suites clave aprobadas:
    - `ventanilla-tupa-vinculo.spec.ts` (16 tests): valida resolución de TUPA antes del CUT, coincidencia de UUID entre esquemas, rechazo de TUPA incompatible o ausente y reversión completa ante fallos SQL.
    - `ventanilla-asiento-v2.spec.ts` (7 tests): valida inserción de columnas V2, asignación de asiento con `seq_asiento_numero_registro` y consistencia transaccional.
    - `ventanilla-registro-acceso.spec.ts` (16 tests): valida autorización RBAC de Ventanilla Presencial.
    - `ventanilla-cargo-acceso.spec.ts` (13 tests): valida generación y visualización de cargo físico.
- **Suite RBAC Institucional (`tests/unit/auth-rbac-persistido.spec.ts`, `rbac-vigencia-fase3b.spec.ts`):**
  - Archivos: 2 suites evaluadas, **2 pasadas (100%)**.
  - Pruebas: **23 pruebas aprobadas**, **0 fallos**.
- **Typecheck Backend (`npm run typecheck`):**
  - Comando: `tsc --noEmit`
  - Resultado: **Exit code 0 (0 errores de tipado)**.

### 9.2. Frontend (`vitest run`)
- **Suite Ventanilla Presencial (`tests/integration/m2/ventanillaPresencial.test.tsx`, `tests/unit/routes/ventanillaRoutes.test.tsx`):**
  - Archivos: 2 suites evaluadas, **2 pasadas (100%)**.
  - Pruebas: **48 pruebas aprobadas**, **0 fallos**.
  - Casos verificados: renderizado de formulario, selección de TUPA, validación de DNI por módulo 11, rechazo de apellidos vacíos, visualización de ticket térmico, modal de cargo oficial con QR y prevención de doble clic / envíos simultáneos.
- **Typecheck Frontend (`npm run typecheck`):**
  - Comando: `tsc --noEmit`
  - Resultado: **Exit code 0 (0 errores de tipado)**.

---

## 10. PROTOCOLO DE EJECUCIÓN E2E PROPUESTO (SIN EJECUTAR)

Se formulan formalmente las dos alternativas para su posterior ejecución cuando sea autorizado explícitamente:

### Alternativa A: Prueba de Integración HTTP Directa

1. **Punto de Entrada:** `POST http://127.0.0.1:3008/api/v1/tramites/ventanilla-presencial`
2. **Autenticación:** Cabecera `Authorization: Bearer <TOKEN_VENTANILLA>` (generado para `ventanilla.demo` con rol `MESA_PARTES`).
3. **Payload a Enviar:**
   ```json
   {
     "tipoPersona": "NATURAL",
     "tipoDocumento": "DNI",
     "dniSolicitante": "44556677",
     "nombres": "CARLOS ALBERTO",
     "apellidos": "MENDOZA RUIZ",
     "correo": "carlos.mendoza@test.suiza.edu.pe",
     "telefono": "961234567",
     "asunto": "SUZ26-050 — Derecho de Reincorporación (Reingreso) - Solicitud de reincorporación periodo 2026-I",
     "foliosTotales": 4,
     "tipoDocumentalId": "b7f37bde-ec45-49d0-b28e-fc2ad4341b60",
     "idTipoTramiteTupa": "65950f60-be67-42c7-8a76-8bb0698f7868"
   }
   ```
4. **Respuesta HTTP Esperada:** Código `201 Created` con JSON:
   ```json
   {
     "expedienteId": "<UUID_GENERADO>",
     "cut": "EXP-2026-000011",
     "anioFiscal": 2026,
     "fechaRadicacion": "<ISO_TIMESTAMP>",
     "ticketImpresion": "<TEXTO_ESC_POS>",
     "cargo": {
       "cut": "EXP-2026-000011",
       "remitente": "CARLOS ALBERTO MENDOZA RUIZ",
       "dni": "44556677",
       "asunto": "SUZ26-050 — Derecho de Reincorporación (Reingreso) - Solicitud de reincorporación periodo 2026-I",
       "folios": 4,
       "fechaRecepcion": "<ISO_TIMESTAMP>",
       "hashSha256": "<HASH_64_HEX>",
       "qrSeguimientoUrl": "http://127.0.0.1:5178/tramite/consulta-publica?cut=EXP-2026-000011"
     }
   }
   ```
5. **Verificaciones Posteriores en PostgreSQL (Solo Lectura):**
   ```sql
   -- 1. Confirmar consumo de correlativos
   SELECT ultimo_correlativo FROM sigd_tra.secuencia_anual_cut WHERE anio_fiscal = 2026; -- Esperado: 11
   SELECT last_value FROM sigd_tra.seq_asiento_numero_registro; -- Esperado: 10010

   -- 2. Confirmar sincronía de expediente
   SELECT codigo_expediente, estado, dni_solicitante FROM sigd_tra.expediente WHERE codigo_expediente = 'EXP-2026-000011';
   SELECT codigo_expediente, tipo_tramite_id FROM sigd_doc.expediente WHERE codigo_expediente = 'EXP-2026-000011';

   -- 3. Confirmar asiento registral presencial
   SELECT numero_registro, canal_ingreso, asunto FROM sigd_tra.asiento_registro WHERE numero_registro = 10010;
   -- Esperado: canal_ingreso = 'MESA_PRESENCIAL'
   ```

---

### Alternativa B: Prueba E2E Completa desde el Navegador

1. **Punto de Entrada:** `http://127.0.0.1:5178/login`
2. **Flujo de Interacción:**
   - Iniciar sesión en el portal como `ventanilla.demo`.
   - Navegar en la barra lateral institucional a **Trámite $\rightarrow$ Ventanilla Presencial** (`/tramite/ventanilla-presencial`).
   - Ingresar DNI `44556677` en el campo "DNI del Solicitante".
   - Ingresar nombres: `CARLOS ALBERTO`, apellidos: `MENDOZA RUIZ`.
   - Ingresar correo de contacto: `carlos.mendoza@test.suiza.edu.pe`, teléfono: `961234567`.
   - En el buscador predictivo de trámites, escribir `SUZ26-050` y seleccionar **"SUZ26-050 — Derecho de Reincorporación (Reingreso)"**.
   - En el selector de tipo documental, seleccionar **"Comprobante de Pago"**.
   - En folios totales, indicar `4`.
   - En asunto, ingresar: `Solicitud de reincorporación periodo 2026-I`.
   - Presionar el botón **"Registrar Trámite Presencial"**.
3. **Comprobaciones en la Interfaz de Usuario:**
   - Despliegue inmediato del componente `CargoDigitalModal`.
   - Visualización del CUT generado `EXP-2026-000011`.
   - Renderizado del código QR de trazabilidad.
   - Presencia del hash criptográfico SHA-256 de 64 caracteres.
   - Disponibilidad del botón de impresión de ticket térmico.
4. **Comprobaciones de Persistencia:** Ejecución de las mismas 3 consultas SELECT detalladas en la Alternativa A.

---

## 11. ERRORES DEMOSTRADOS, CAUSAS Y SOLUCIONES

| # | Error / Discrepancia Demostrada | Causa Raíz Identificada | Solución Técnica Formulada |
| :---: | :--- | :--- | :--- |
| **1** | Discrepancia de puertos en informes previos (3000/5173 vs 3008/5178). | En `scratch/serve_demo.ts` y `scripts/iniciar-sigd-local.ps1` se implementó el aislamiento en puertos 3008 y 5178 para prevenir colisiones locales. | Documentar formalmente 3008 (backend) y 5178 (frontend) como las direcciones reales del entorno activo. |
| **2** | Rechazo inminente de payload por campos desconocidos (`administrado`, `anexos`, etc.). | Confusión conceptual entre el contrato de Mesa de Partes Virtual y el contrato estricto de Ventanilla Presencial. | Formulación del payload plano conforme a `ventanillaPresencialSchema` y eliminación de la sección de adjuntos S3. |
| **3** | Mismo UUID documental (`b7f37bde...`) repetido para FUT y Comprobante. | Desconocimiento del contenido de `sigd_doc.tipo_documento`, donde `b7f37bde...` es exclusivamente `COMPROBANTE_PAGO`. | Corrección del mapeo documental; asignación de `b7f37bde...` a `tipoDocumentalId` como único requisito canónico admitido por `SUZ26-050`. |
| **4** | Hash sintético vacío `e3b0c442...` en payload previo. | Se asumió que el cliente enviaba el hash del archivo, cuando en Ventanilla Presencial el hash del cargo lo genera el servidor a partir de los metadatos de recepción física. | Eliminación del hash en la petición; verificación del cálculo en el servidor. |
| **5** | Nombre erróneo de procedimiento en consigna ("SUZ26-050 Certificado de Estudios"). | En la base institucional `SUZ26-050` es "Derecho de Reincorporación", mientras que Certificado de Estudios es `SUZ26-035`. | Alineación de sumilla y asunto con la denominación oficial de `SUZ26-050` registrada en PostgreSQL. |

---

## 12. LIMITACIONES PENDIENTES

1. **Ejecución Persistente en Base de Datos:** Conforme a las reglas inmutables de protección del proyecto, **no se ha realizado el POST transaccional**. Por tanto, el consumo de `EXP-2026-000011` y del asiento `10010` permanece estrictamente como una predicción comprobada y no como un hecho persistido.
2. **Automatización Browser Playwright en Modo Headless:** La Alternativa B requiere el lanzamiento del entorno Vite en el puerto 5178 con backend activo en el puerto 3008; su ejecución browser requiere autorización para disparar el evento de envío desde la interfaz web.

---

## 13. DECLARACIÓN DE OPERACIONES QUE NO SE EJECUTARON

Se deja constancia explícita de que, durante toda la preauditoría y comprobación de contratos:
1. **NO se ejecutó el endpoint `POST /api/v1/tramites/ventanilla-presencial`**.
2. **NO se invocó la función `sigd_tra.generar_cut_expediente(2026)`**.
3. **NO se llamó a `nextval()` sobre `sigd_tra.seq_asiento_numero_registro`**.
4. **NO se ejecutó ninguna sentencia `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `DROP` ni `ALTER`** en ninguna tabla ni esquema de PostgreSQL.
5. **NO se escribió ningún objeto en MinIO** ni se alteraron claves en Redis.
6. **NO se accedió ni modificó la base institucional `sigd_prueba`**.
7. **NO se ejecutaron `git reset`, `git clean` ni se destruyeron modificaciones previas**.

---

## 14. DECLARACIÓN FINAL DE SEGURIDAD

En cumplimiento riguroso de las directivas institucionales del SIGD IESTP Suiza 2026:

- [x] **No se ejecutó el POST de radicación presencial.**
- [x] **No se creó ningún expediente ni asiento registral.**
- [x] **No se consumió ningún CUT ni correlativo.**
- [x] **No se ejecutaron operaciones DDL ni DML.**
- [x] **No se modificaron datos ni objetos en MinIO ni en Redis.**
- [x] **La base institucional `sigd_prueba` permaneció 100% aislada e intacta.**
- [x] **Se preservaron todos los cambios previos de Codex y Antigravity (154 archivos de trabajo intactos).**
- [x] **No se crearon commits ni se realizó push en Git.**

---
*Fin del informe de preauditoría técnica. Sistema preparado y detenido en espera de autorización explícita para la ejecución de la prueba E2E.*
