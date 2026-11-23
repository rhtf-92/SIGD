# INFORME TÉCNICO DE IMPLEMENTACIÓN INTEGRAL — PROCEDIMIENTO TUPA SUZ26-034
## CERTIFICADO DE ESTUDIOS SUPERIORES (6 SEMESTRES)
**Institución:** Instituto de Educación Superior Tecnológico Público «Suiza» — Pucallpa, Ucayali  
**Sistema:** Sistema Integrado de Gestión Documental y Archivo Institucional (SIGD RENATO)  
**Rama Exclusiva:** `B_JACOBO`  
**Base de Datos Autorizada:** `sigd_jacobo_demo` (PostgreSQL 5433)  
**Fecha:** 19 de noviembre de 2026  
**Responsable:** Arquitectura de Software y Seguridad Digital SIGD  

---

## 1. RESUMEN EJECUTIVO DE LA IMPLEMENTACIÓN

Se ha culminado la implementación integral de extremo a extremo del procedimiento institucional **SUZ26-034 — Certificado de Estudios Superiores (6 semestres)**, correspondiente al Texto Único de Procedimientos Administrativos (TUPA 2026, página 4) del Instituto de Educación Superior Tecnológico Público «Suiza».

La solución abarca desde la radicación por el ciudadano y la conciliación de la tasa de tramitación de S/ 124.00 (2.24% de la UIT vigente) en Tesorería, hasta la verificación interna de antecedentes académicos en Secretaría Académica (sin exigir certificados ni constancias que obran en custodia institucional), la proyección del certificado en formato A4 con membrete oficial, la elevación y suscripción digital mediante firma electrónica PAdES por la Dirección General, la auditoría inmutable WORM, el despacho por Transactional Outbox y la notificación fehaciente a la Casilla Electrónica del administrado, junto con la consulta pública mediante Código de Verificación Digital (CVD).

---

## 2. CONTRASTE NORMATIVO: TUPA OFICIAL 2026 VS. IMPLEMENTACIÓN

| Parámetro TUPA | Fuente Normativa (TUPA 2026, p. 4) | Implementación en SIGD RENATO | Estado de Conformidad |
| :--- | :--- | :--- | :--- |
| **Código TUPA** | `034` (Visible: `SUZ26-034`) | Identificador canónico `3443d0c0-ebaf-48d2-a4d0-2c32ec1fc6dd`. Soporta `SUZ26-034` (visible/oficial) y alias interno `SUZ26-035` para compatibilidad de correlativos históricos. | **CONFORME** |
| **Denominación** | Certificado de Estudios Superiores (6 semestres) | "Certificado de Estudios Superiores (6 semestres)" en catálogo, base de datos y vistas | **CONFORME** |
| **Derecho de Trámite** | S/ 124.00 (2.24 % UIT vigente) | `sigd_tes.tarifa`: S/ 124.00 PEN, estado `VALIDADA`. Validación criptográfica en FSM y emisión. | **CONFORME** |
| **Lugar de Pago** | Tesorería institucional | Módulo de Tesorería (`sigd_tes.orden_pago`, `sigd_tes.pago`), Recibo Oficial de Caja. | **CONFORME** |
| **Requisito 1** | Solicitud Formal Única de Trámite (FUT) | Obligatorio (orden 1). Se genera o adjunta al radicar el expediente. | **CONFORME** |
| **Requisito 2** | Comprobante de pago | Mención documental no bloqueante (orden 0/2). La verificación del pago se realiza por interoperabilidad interna con Tesorería. | **CONFORME** |
| **Anexos Adicionales** | Ninguno establecido | Sin anexos inventados ni cargas documentales artificiales para el ciudadano. | **CONFORME** |
| **Regla LPAG Art. 48** | Prohibición de exigir documentos en custodia | Secretaría Académica consulta internamente los 6 semestres en `sigd_doc.registro_estudios_superiores`. | **CONFORME** |
| **Unidad Receptora** | Mesa de Partes (MP) | `sigd_org.area`: MP recibe y radica. | **CONFORME** |
| **Unidad Responsable** | Secretaría Académica (SEC) | `sigd_org.area`: SEC califica, revisa actas y proyecta borrador. | **CONFORME** |
| **Autoridad Resolutiva** | Dirección General (DG) | `sigd_org.area`: DG aprueba, suscribe con firma PAdES y resuelve el expediente. | **CONFORME** |
| **Plazo Máximo** | 30 días hábiles (silencio negativo) | SLA de 30 días configurado en RutaDoc con semáforo preventivo. | **CONFORME** |

---

## 3. DECISIONES TÉCNICAS Y ARQUITECTÓNICAS ADOPTADAS

1. **Resolución de Discrepancia de Mapeo de Códigos (`SUZ26-034` vs `SUZ26-035`):**
   En migraciones previas del prototipo, el procedimiento 034 de la página 4 del TUPA figuraba indexado en la tabla `sigd_doc.tipo_tramite_tupa` con el id `3443d0c0-ebaf-48d2-a4d0-2c32ec1fc6dd` y clave interna `SUZ26-035`, mientras que `SUZ26-034` apuntaba a Expedición de Título (S/ 105.00). Para preservar la retrocompatibilidad con expedientes existentes y garantizar cumplimiento estricto del TUPA, tanto el backend (`CODIGOS_PROCEDIMIENTO_CERTIFICADO_ESTUDIOS = ['SUZ26-034', 'SUZ26-035']`) como el frontend reconocen ambos códigos de manera intercambiable, presentando siempre al ciudadano el rótulo oficial `SUZ26-034`.

2. **Cero Exigencia de Documentación en Custodia Institucional (TUO LPAG, D.S. 004-2019-JUS, Art. 48):**
   Se implementó la tabla `sigd_doc.registro_estudios_superiores` que almacena el historial académico oficial del IESTP «Suiza» (semestres cursados, asignaturas, créditos, horas, promedios y actas). Secretaría Académica verifica estos datos de oficio sin demandar al egresado certificados de estudios previos o copias de actas.

3. **Bloqueo FSM por Pagos Pendientes (`sigd_tes`):**
   Se integró la validación financiera: tanto la calificación favorable de Secretaría Académica como la proyección del borrador oficial bloquean la operación si el derecho de S/ 124.00 no figura con estado `VERIFICADO` en Tesorería.

4. **Proyección Documental A4 con Trazabilidad CVD Preliminar:**
   El motor `a4GeneratorService` compone dinámicamente el Certificado Oficial de Estudios Superiores con el membrete institucional, los datos de identificación, el cuadro consolidado de los 6 semestres (I al VI), horas totales, créditos y promedio ponderado vigesimal, insertando el CVD preliminar antes del almacenamiento en MinIO (`certificados-estudios/BORR-EST-YYYY-XXXX.pdf`).

5. **Suscripción Digital PAdES / ReFirma y Cierre Automático:**
   El servicio `callbackRefirma.service.ts` valida criptográficamente el PDF firmado por la Dirección General, actualiza el estado a `EMITIDO_FIRMADO`, transiciona el expediente a `RESUELTO` en RutaDoc, y genera un evento en `sigd_audit.evento_outbox` para la entrega automática en Casilla Electrónica.

---

## 4. ESTADO DEL PROCEDIMIENTO ANTES Y DESPUÉS DE LA INTERVENCIÓN

| Aspecto | Estado Previo | Estado Posterior a la Implementación |
| :--- | :--- | :--- |
| **Configuración TUPA** | Incompleta / Discrepante con SUZ26-035 | Migración 35 ejecutada, procedimiento formalizado, FUT obligatorio, COMPROBANTE_PAGO regularizado |
| **Tipo Documental** | No existía tipo documental específico para Certificado de Estudios Superiores | `CERTIFICADO_ESTUDIOS` configurado en `sigd_doc.tipo_documento` (PDF, 20MB, exige_firma=true) |
| **Historial Académico** | Sin repositorio de actas consolidadas para estudios superiores | Creada tabla `sigd_doc.registro_estudios_superiores` con semestres acreditados, créditos y actas |
| **Calificación Académica** | Genérica sin verificación de semestres | Creada tabla `sigd_doc.verificacion_academica_estudios` con dictamen técnico vinculante |
| **Proyección de Certificado** | Inexistente (no generaba PDF A4) | `proyectarCertificadoEstudios` genera documento A4 con desglose de 6 semestres, folios y MinIO |
| **Firma Digital & Refirma** | Webhook solo reconocía resoluciones y certificados de inglés | Integrado branch `certificados-estudios/` en `callbackRefirma.service.ts` |
| **Notificación Ciudadana** | No se despachaba aviso de emisión de certificado | Outbox worker despacha `certificado_emitido` a Casilla Electrónica del administrado |
| **Validación CVD** | No contemplaba certificados de estudios | `validadorCvd.controller.ts` ampliado para validar certificados de estudios superiores |
| **Interfaz de Usuario** | Sin panel de verificación de 6 semestres | `CertificadoEstudiosPanel.tsx` integrado en `ExpedienteDetallePage.tsx` |

---

## 5. ARCHIVOS CREADOS, MODIFICADOS Y ELIMINADOS

### Archivos Creados
1. `backend/migraciones/35_sigd_doc_suz26_034_certificado_estudios_superiores.sql`: Migración DDL/DML que inicializa tipos, requisitos, reglas de cierre, tabla de estudios superiores, verificación técnica y certificados.
2. `backend/src/domains/docucore/certificadoEstudios.service.ts`: Lógica de dominio, consulta de pagos, verificación académica de los 6 semestres y proyección de PDF A4 oficial.
3. `backend/src/domains/docucore/certificadoEstudios.controller.ts`: Rutas express `/api/v1/certificados-estudios` protegidas con JWT y RBAC.
4. `frontend/src/components/expedientes/CertificadoEstudiosPanel.tsx`: Componente interactivo para calificación de 6 semestres, revisión de pagos, proyección y elevación a firma.
5. `backend/tests/unit/domains/docucore/certificado-estudios.spec.ts`: Suite de pruebas unitarias institucionales con Vitest (7 pruebas exitosas).
6. `scratch/test-suz034-e2e-live.mjs`: Script de validación en vivo de integridad contra `sigd_jacobo_demo`.

### Archivos Modificados
1. `backend/src/domains/docucore/callbackRefirma.service.ts`: Incorporación de lógica para firma de certificados de estudios, cierre en FSM y emisión en Outbox.
2. `backend/src/domains/docucore/validadorCvd.controller.ts`: Soporte de consulta pública de certificados de estudios superiores mediante CVD.
3. `backend/src/app.ts`: Registro del enrutador `/api/v1/certificados-estudios`.
4. `frontend/src/pages/expedientes/ExpedienteDetallePage.tsx`: Integración del panel especializado para trámites `SUZ26-034` y `SUZ26-035`.
5. `frontend/src/data/catalogoDocumentalTupa2026.ts`: Formalización de `SUZ26-034` como VALIDADO con 30 días, silencio negativo y requisitos oficiales.

### Archivos Eliminados
- Ninguno. Se mantuvo estricta preservación del árbol preexistente.

---

## 6. CAMBIOS EN BASE DE DATOS (`sigd_jacobo_demo`)

### Migración Ejecutada: `35_sigd_doc_suz26_034_certificado_estudios_superiores.sql`

```sql
-- 1. Tipo documental oficial
INSERT INTO sigd_doc.tipo_documento (tipo_documental_id, codigo, nombre, extension, mime_type, tamano_maximo_mb, exige_firma, vigente)
VALUES ('d13411ac-c471-4f2d-a759-fb18ff270fe8', 'CERTIFICADO_ESTUDIOS', 'Certificado Oficial de Estudios Superiores (6 semestres) — IESTP Suiza', 'pdf', 'application/pdf', 20, TRUE, TRUE)
ON CONFLICT (codigo) DO UPDATE SET vigente = TRUE;

-- 2. Repositorio de Registros de Estudios Superiores
CREATE TABLE IF NOT EXISTS sigd_doc.registro_estudios_superiores (
  registro_estudio_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_documento_identidad VARCHAR(20) NOT NULL DEFAULT 'DNI',
  numero_documento_identidad VARCHAR(20) NOT NULL,
  persona_id UUID REFERENCES sigd_auth.persona(id_persona),
  apellidos_nombres VARCHAR(255) NOT NULL,
  codigo_matricula VARCHAR(50),
  programa_estudios VARCHAR(150) NOT NULL,
  plan_estudios VARCHAR(100) NOT NULL DEFAULT 'Plan de Estudios Modular',
  modalidad_estudio VARCHAR(50) NOT NULL DEFAULT 'PRESENCIAL',
  periodo_ingreso VARCHAR(20) NOT NULL,
  periodo_egreso VARCHAR(20),
  total_semestres INT NOT NULL DEFAULT 6,
  semestres_aprobados JSONB NOT NULL DEFAULT '[]',
  horas_academicas_totales INT NOT NULL DEFAULT 2880,
  creditos_totales NUMERIC(6,2) NOT NULL DEFAULT 130.00,
  promedio_final NUMERIC(4,2) NOT NULL,
  nota_minima_aprobatoria NUMERIC(4,2) NOT NULL DEFAULT 13.00,
  fecha_inicio DATE NOT NULL,
  fecha_termino DATE,
  culminado BOOLEAN NOT NULL DEFAULT FALSE,
  aprobado BOOLEAN NOT NULL DEFAULT FALSE,
  numero_acta_final VARCHAR(100),
  estado_academico VARCHAR(30) NOT NULL DEFAULT 'CULMINADO_APROBADO',
  observaciones TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 3. Verificación Académica Técnica (SEC)
CREATE TABLE IF NOT EXISTS sigd_doc.verificacion_academica_estudios (
  verificacion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID NOT NULL REFERENCES sigd_doc.expediente(expediente_id) ON DELETE RESTRICT,
  registro_estudio_id UUID REFERENCES sigd_doc.registro_estudios_superiores(registro_estudio_id),
  dni_verificado VARCHAR(20) NOT NULL,
  semestres_verificados INT NOT NULL DEFAULT 0,
  culminado_verificado BOOLEAN NOT NULL DEFAULT FALSE,
  aprobado_verificado BOOLEAN NOT NULL DEFAULT FALSE,
  pago_tesoreria_verificado BOOLEAN NOT NULL DEFAULT FALSE,
  numero_recibo_tesoreria VARCHAR(50),
  numero_acta_referencia VARCHAR(100),
  programa_estudios VARCHAR(150),
  plan_estudios VARCHAR(100),
  creditos_totales NUMERIC(6,2),
  horas_academicas INT,
  promedio_final NUMERIC(4,2),
  detalle_semestres_verificados JSONB NOT NULL DEFAULT '[]',
  resultado VARCHAR(30) NOT NULL CHECK (resultado IN ('FAVORABLE', 'OBSERVADO', 'IMPROCEDENTE')),
  observaciones_academicas TEXT NOT NULL,
  verificado_por UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario),
  verificado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  vigente BOOLEAN NOT NULL DEFAULT TRUE
);

-- 4. Certificados de Estudios Superiores Proyectados y Emitidos
CREATE TABLE IF NOT EXISTS sigd_doc.certificado_estudios_superiores (
  certificado_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID NOT NULL REFERENCES sigd_doc.expediente(expediente_id) ON DELETE RESTRICT,
  verificacion_id UUID NOT NULL REFERENCES sigd_doc.verificacion_academica_estudios(verificacion_id),
  numero_borrador VARCHAR(50) NOT NULL,
  numero_certificado VARCHAR(50),
  titular_persona_id UUID NOT NULL REFERENCES sigd_auth.persona(id_persona),
  titular_nombre VARCHAR(255) NOT NULL,
  titular_documento VARCHAR(20) NOT NULL,
  programa_estudios VARCHAR(150) NOT NULL,
  plan_estudios VARCHAR(100) NOT NULL,
  semestres_acreditados JSONB NOT NULL DEFAULT '[]',
  horas_academicas INT NOT NULL,
  creditos_totales NUMERIC(6,2) NOT NULL,
  promedio_final NUMERIC(4,2) NOT NULL,
  periodo_estudios VARCHAR(50) NOT NULL,
  numero_acta VARCHAR(100) NOT NULL,
  asunto VARCHAR(255) NOT NULL,
  cvd VARCHAR(64) NOT NULL,
  estado VARCHAR(30) NOT NULL CHECK (estado IN ('BORRADOR_PENDIENTE_FIRMA', 'EN_FIRMA', 'EMITIDO_FIRMADO', 'NOTIFICADO', 'ANULADO')),
  documento_adjunto_id UUID REFERENCES sigd_doc.documento_adjunto(documento_adjunto_id),
  proyectado_por UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario),
  fecha_proyeccion DATE NOT NULL DEFAULT CURRENT_DATE,
  firmado_por UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario),
  firmado_en TIMESTAMPTZ,
  hash_pades VARCHAR(128)
);
```

---

## 7. ENDPOINTS CREADOS O MODIFICADOS

| Método | Ruta | Control de Acceso (RBAC) | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/certificados-estudios/expediente/:expedienteId` | Autenticado / Titular / Operador con vista | Retorna estado de calificación de 6 semestres, estado de Tesorería (S/ 124.00), registros disponibles y borrador. |
| `POST` | `/api/v1/certificados-estudios/expediente/:expedienteId/verificar-antecedentes` | `SECRETARIO` o `ADMINISTRADOR` (área `SEC`) | Registra dictamen técnico de 6 semestres con trazabilidad WORM. |
| `POST` | `/api/v1/certificados-estudios/expediente/:expedienteId/proyectar` | `SECRETARIO` o `ADMINISTRADOR` (área `SEC`) | Genera PDF A4 oficial, sube a MinIO (`certificados-estudios/`), asigna CVD y folios. |
| `POST` | `/api/v1/firma/webhook` (Callback Refirma) | Autenticado con secreto HMAC SHA-256 | Valida firma digital PAdES, transiciona expediente a `RESUELTO` y despacha evento Outbox. |
| `GET` | `/api/v1/docucore/validador-cvd/:cvd` | Público | Consulta pública institucional de autenticidad e integridad del certificado emitido. |

---

## 8. COMPONENTES FRONTEND CREADOS O MODIFICADOS

1. **`frontend/src/components/expedientes/CertificadoEstudiosPanel.tsx` (Nuevo):**
   - Tarjetas de estado con indicadores de pago de S/ 124.00, cumplimiento de requisitos TUPA y verificación técnica.
   - Tabla interactiva que detalla los 6 semestres académicos: semestre, periodo, créditos, horas, promedio semestral y condición aprobatoria.
   - Formulario de calificación de Secretaría Académica para emitir dictamen `FAVORABLE`, `OBSERVADO` o `IMPROCEDENTE`.
   - Botón de generación y descarga del borrador oficial en PDF A4.
   - Botón de elevación y derivación a la Dirección General para suscripción digital.
   - Acceso al Validador CVD público y visualización de hash criptográfico PAdES.
2. **`frontend/src/pages/expedientes/ExpedienteDetallePage.tsx` (Modificado):**
   - Incorporación condicional de `CertificadoEstudiosPanel` cuando el expediente corresponde a los códigos `SUZ26-034` o `SUZ26-035`.
3. **`frontend/src/data/catalogoDocumentalTupa2026.ts` (Modificado):**
   - Procedimiento marcado como `VALIDADO` con costo oficial de S/ 124.00, unidad responsable Secretaría Académica y autoridad resolutiva Dirección General.

---

## 9. TRAZABILIDAD WORM Y TRANSACTIONAL OUTBOX

### Registro WORM (`sigd_audit.bitacora_auditoria`)
Toda mutación sobre la verificación académica y el certificado se persiste de forma inmutable:
- **Evento 1 (Verificación):** Esquema `sigd_doc`, tabla `verificacion_academica_estudios`, operación `INSERT`, registrando el resultado (`FAVORABLE`), los semestres validados (6) y el operador responsable.
- **Evento 2 (Proyección):** Esquema `sigd_doc`, tabla `certificado_estudios_superiores`, operación `INSERT`/`UPDATE`, persistiendo el CVD generado, el hash SHA-256 del PDF y la clave en MinIO.
- **Evento 3 (Firma Digital):** Esquema `sigd_doc`, tabla `certificado_estudios_superiores`, operación `UPDATE`, persistiendo el hash PAdES, el firmante y la estampa de tiempo TSA.

### Transactional Outbox (`sigd_audit.evento_outbox`)
Al confirmarse la firma digital mediante el webhook de Refirma, se inserta atómicamente el evento:
```json
{
  "agregado": "certificado_estudios",
  "tipo_evento": "certificado_emitido",
  "payload": {
    "documento_id": "a3400001-0000-4000-8000-000000000001",
    "certificado_id": "c3400001-0000-4000-8000-000000000001",
    "expediente_id": "22222222-2222-4222-8222-222222222222",
    "numero_certificado": "EST-2026-0001",
    "cvd": "CVD-EST-FINAL000001",
    "sha256_firmado": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    "firmado_en": "2026-11-19T16:30:00.000Z",
    "usuario_id": "00000000-0000-0000-0000-000000000050",
    "cut": "EXP-2026-000341",
    "asunto": "Certificado de Estudios Superiores EST-2026-0001 emitido — Expediente EXP-2026-000341",
    "tipo_acto": "certificado_emitido",
    "numero_documento": "EST-2026-0001"
  }
}
```
El worker (`DestinoCasilla`) consume este evento y deposita la notificación con valor legal en la Casilla Electrónica (`sigd_auth.notificacion_casilla`) del administrado.

---

## 10. FLUJO DE TESORERÍA IMPLEMENTADO Y VALIDACIONES DE PAGO

1. Al crearse el expediente, se asocia la tasa de tramitación de S/ 124.00 correspondiente a la tarifa `a34b6891-a98b-489e-883d-a4d5ca9fb863`.
2. Tesorería emite la orden de pago en `sigd_tes.orden_pago` y registra el cobro en `sigd_tes.pago`.
3. Al conciliarse el pago, el estado pasa a `VERIFICADO` con el número de recibo oficial de caja (ej. `RC-2026-00124`).
4. **Regla de bloqueo:** Si un operador intenta emitir calificación técnica favorable o proyectar el certificado mientras el pago está pendiente, el backend rechaza la petición con `409 Conflict` (`PAGO_TESORERIA_NO_VERIFICADO`).

---

## 11. VERIFICACIÓN ACADÉMICA (SECRETARÍA ACADÉMICA)

1. **Consulta de Antecedentes:** Se recuperan las actas consolidadas mediante consulta por DNI o ID de persona en `sigd_doc.registro_estudios_superiores`.
2. **Criterios de Aprobación de los 6 Semestres:**
   - Total de semestres cursados = exactamente 6 (Semestres I al VI).
   - Todos los semestres en condición `APROBADO` con promedio semestral $\ge$ 13.00.
   - Mínimo de 130 créditos académicos y 2880 horas lectivas aprobadas.
   - Condición académica general = `CULMINADO_APROBADO`.
3. **Casos de Control Negativo Implementados:**
   - DNI `99000051`: 4 semestres cursados (`INCOMPLETO`). El sistema bloquea dictamen favorable indicando que no reúne los 6 semestres normativos.
   - DNI `99000052`: 6 semestres cursados con promedio 11.22 (`DESAPROBADO`). El sistema bloquea dictamen favorable.
4. **Dictamen de Calificación:**
   - `FAVORABLE`: Habilita la proyección del certificado oficial.
   - `OBSERVADO`: Genera observación administrativa en RutaDoc para subsanación.
   - `IMPROCEDENTE`: Cierra negativamente el trámite sin emisión documental.

---

## 12. EMISIÓN DOCUMENTAL: FORMATO, FOLIADO, FIRMA Y CVD

1. **Maquetación PDF A4:** Se utiliza el motor institucional `a4GeneratorService`, asegurando márgenes oficiales (25 mm), tipografía estándar, membrete institucional del IESTP «Suiza», cuerpo certificatorio con base legal y tabla formal de calificaciones de los 6 semestres.
2. **Foliado Institucional AGN:** Al proyectar el documento, se calcula el correlativo de folios en `sigd_doc.documento_adjunto` conforme a las reglas del Archivo General de la Nación.
3. **Firma Digital PAdES:** La Dirección General suscribe el PDF a través del conector ReFirma / Firmador Web. Se exige estampa de tiempo TSA y verificación de no revocación.
4. **Código de Verificación Digital (CVD):**
   - Formato: `CVD-EST-` seguido de 16 caracteres alfanuméricos en base hexadecimal/hash seguro.
   - Validación pública disponible en la ruta `/validador-cvd`, que coteja el CVD en tiempo real contra `sigd_doc.certificado_estudios_superiores` y devuelve los datos del egresado, fecha de expedición y estado de validez legal.

---

## 13. SEGURIDAD Y CONTROL DE ACCESO (RBAC)

| Actuación Administrativa | Rol Requerido | Área Requerida | Estado de Trámite Exigido |
| :--- | :--- | :--- | :--- |
| **Radicación** | `CIUDADANO` o `MESA_PARTES` | MP o Portal Virtual | `REGISTRADO` |
| **Recepción & Derivación** | `MESA_PARTES` o `SECRETARIO` | MP o SEC | `EN_RECEPCION` |
| **Verificación de 6 Semestres** | `SECRETARIO` o `ADMINISTRADOR` | SEC | `EN_REVISION` |
| **Proyección de Borrador** | `SECRETARIO` o `ADMINISTRADOR` | SEC | `EN_REVISION` |
| **Aprobación & Despacho a Firma** | `DIRECTOR` o `ADMINISTRADOR` | DG | `EN_REVISION` / `EN_FIRMA` |
| **Suscripción Digital ReFirma** | `DIRECTOR` | DG | `EN_FIRMA` |
| **Acceso a Casilla Electrónica** | Titular del expediente | Casilla Personal | Cualquiera |

---

## 14. BRECHAS INSTITUCIONALES DETECTADAS Y DOCUMENTADAS

1. **Ausencia del Área `TES` (Tesorería) en `sigd_org.area`:**
   En el catálogo de áreas institucionales únicamente existen:
   - `AC`: Archivo Central
   - `DG`: Dirección General
   - `MP`: Mesa de Partes
   - `SEC`: Secretaría Académica  
   No existe el área `TES` como nodo formal en la estructura orgánica del SIGD. Siguiendo la prohibición estricta de no inventar áreas, los roles de cobro y conciliación operan en el esquema `sigd_tes` sin requerir una derivación física a un área inexistente.
2. **Inactivación de Roles Financieros Secundarios:**
   En `sigd_org.rol_sistema`, únicamente el rol `TESORERO` se encuentra activo (`vigente = true`). Los roles `CAJERO`, `SUPERVISOR_TESORERIA` y `APROBADOR_DEVOLUCIONES` se encuentran inactivos (`vigente = false`). Se recomienda a la Oficina de Administración del IESTP «Suiza» formalizar la reactivación de estos roles mediante resolución directoral.

---

## 15. EVIDENCIA DE PRUEBAS EJECUTADAS

### Pruebas Unitarias Automatizadas (Vitest)
Ejecutadas con el comando `npx --prefix backend vitest run tests/unit/domains/docucore/certificado-estudios.spec.ts`:
```
 ✓ backend/tests/unit/domains/docucore/certificado-estudios.spec.ts (7 tests) 254ms
   ✓ 1. Configura SUZ26-034 en catálogo institucional TUPA 2026 con S/ 124.00, FUT obligatorio y sin anexos externos
   ✓ 2. Bloquea verificación académica FAVORABLE cuando el usuario no ostenta el rol SECRETARIO
   ✓ 3. Bloquea verificación académica FAVORABLE si el pago en Tesorería (S/ 124.00) está pendiente
   ✓ 4. Bloquea verificación académica FAVORABLE si el solicitante no culminó los 6 semestres requeridos
   ✓ 5. Registra dictamen FAVORABLE y WORM cuando el solicitante tiene los 6 semestres aprobados y pago verificado
   ✓ 6. Proyecta borrador oficial (PDF A4), asigna número BORR-EST-YYYY-XXXX y genera CVD preliminar
   ✓ 7. Callback Refirma procesa la firma digital PAdES, transiciona expediente a RESUELTO y emite evento Outbox para Casilla

 Test Files  1 passed (1)
      Tests  7 passed (7)
```

### Comprobación de No Regresión
Ejecutadas las pruebas del Certificado de Inglés (`certificado-ingles.spec.ts`):
```
 ✓ backend/tests/unit/domains/docucore/certificado-ingles.spec.ts (5 tests) 102ms
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

### Compilación y Chequeo de Tipos Estricto
- Backend (`npm --prefix backend run typecheck`): **0 errores** (`exit code 0`).
- Frontend (`npm --prefix frontend run typecheck`): **0 errores** (`exit code 0`).

---

## 16. INSTRUCCIONES PARA OPERACIÓN Y MANTENIMIENTO DEL PROCEDIMIENTO

1. **Para el Egresado / Ciudadano:**
   - Ingresar a la Mesa de Partes Virtual y seleccionar el trámite **SUZ26-034 — Certificado de Estudios Superiores (6 semestres)**.
   - Completar el formulario FUT digital y consignar sus datos de matrícula. No se requiere adjuntar constancias de notas ni fotos.
   - Pagar la tasa de S/ 124.00 en Tesorería del Instituto o mediante transferencia en cuenta oficial de ingresos propios.
2. **Para Mesa de Partes:**
   - Radicar el expediente, verificar que el FUT contenga petitorio claro y derivar a Secretaría Académica (`SEC`).
3. **Para Secretaría Académica:**
   - Abrir el expediente en el SIGD; el panel especializado mostrará el historial consolidado de los 6 semestres del alumno y el estado del pago en Tesorería.
   - Emitir dictamen técnico `FAVORABLE` tras corroborar las actas en custodia.
   - Presionar "Proyectar Certificado Oficial de Estudios Superiores (PDF A4)".
   - Derivar el expediente a la Dirección General (`DG`).
4. **Para la Dirección General:**
   - Abrir el expediente, verificar el dictamen técnico y la vista previa del certificado proyectado.
   - Presionar "Aprobar y Elevar a Firma Digital" y suscribir mediante el firmador oficial ReFirma.
   - El sistema resolverá automáticamente el expediente y depositará el certificado oficial con CVD en la Casilla Electrónica del egresado.
