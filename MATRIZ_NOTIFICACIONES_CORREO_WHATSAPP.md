# SIGD RENATO — MATRIZ DE NOTIFICACIONES MULTICANAL: CORREO ELECTRÓNICO Y WHATSAPP (SANDBOX)

**Institución:** Instituto de Educación Superior Tecnológico Público «Suiza» — Pucallpa, Ucayali  
**Sistema:** Sistema Integral de Gestión Documentaria — SIGD RENATO  
**Base Legal:** TUO de la Ley N° 27444 (D.S. 004-2019-JUS, Arts. 20 y 21 — Régimen de Notificaciones Administrativas); Decreto Legislativo N° 1412 (Ley de Gobierno Digital); Decreto Supremo N° 029-2021-PCM (Reglamento de la Ley de Gobierno Digital); Ley N° 29733 (Protección de Datos Personales).  
**Rama Oficial:** `B_JACOBO`  
**Base de Datos:** `sigd_jacobo_demo` (PostgreSQL 18 en puerto 5433)  
**Fecha de Certificación:** 22 de Noviembre de 2026  

---

## 1. POLÍTICA Y ESTRATEGIA DE NOTIFICACIÓN MULTICANAL

El régimen de notificaciones del SIGD RENATO se estructura bajo el principio de **eficacia del acto administrativo** y **seguridad jurídica**:
1. **Canal Principal de Actos Resolutivos:** Casilla Electrónica Oficial para administrados registrados, garantizando acuse de recibo con valor probatorio pericial, sellado de tiempo y Código de Verificación Digital (CVD).
2. **Canal Informativo y Preventivo General (Correo Electrónico):** Despachado asíncronamente mediante el patrón arquitectónico **Transactional Outbox**, cubriendo 16 eventos del ciclo de vida documental sin riesgo de inconsistencia ni acoplamiento temporal.
3. **Canal Complementario Directo al Móvil (WhatsApp):** Clasificado **ESTRICTAMENTE COMO SANDBOX** (`SANDBOX_WHATSAPP_CLOUD_API`). Diseñado para activarse **ÚNICAMENTE AL CIERRE DEFINITIVO DEL TRÁMITE**, evitando spam al ciudadano y reservando la mensajería instantánea para hitos perentorios y resolutivos.

---

## 2. CATÁLOGO MAESTRO DE EVENTOS Y CANALES

| N° | Evento del Transactional Outbox | Origen / Módulo | Canal Casilla | Canal Correo Electrónico (Outbox) | Canal WhatsApp (Sandbox) | Plantilla / Contenido Institucional |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| **01** | `radicacion_exitosa` | TramiCore | — | **SÍ** | — | Confirmación de radicación formal con código CUT y enlace de consulta. |
| **02** | `orden_pago_generada` | Tesorería | — | **SÍ** | — | Notificación de orden de pago con monto, tasa TUPA y plazo de 15 días hábiles. |
| **03** | `pago_confirmado` | Tesorería | — | **SÍ** | — | Constancia de pago validado en Caja/Banco e inicio de calificación. |
| **04** | `expediente_habilitado_recepcion` | TramiCore | — | **SÍ** | — | Aviso de habilitación inmediata para atención en Mesa de Partes. |
| **05** | `recepcion_formal_mp` | Mesa de Partes | — | **SÍ** | — | Emisión de Cargo Digital de Recepción con código `CRG-YYYY-XXXXXX` y hash SHA-256. |
| **06** | `calificacion_iniciada` | RutaDoc | — | **SÍ** | — | Asignación de expediente y apertura de evaluación de admisibilidad TUPA. |
| **07** | `conformidad_documental` | RutaDoc | — | **SÍ** | — | Declaración de conformidad técnica de requisitos y pase a área sustantiva. |
| **08** | `observacion_notificada` | RutaDoc / MP | **SÍ** | **SÍ** | — | Pliego formal de observaciones con plazo perentorio de subsanación de 2 días. |
| **09** | `pase_derivacion` | RutaDoc | — | **SÍ** | — | Derivación interinstitucional de área origen a área de destino con proveído. |
| **10** | `recepcion_destino` | RutaDoc | — | **SÍ** | — | Recepción de acuse en unidad orgánica ejecutora (ej. Secretaría Académica). |
| **11** | `evaluacion_iniciada` | Área Sustantiva | — | **SÍ** | — | Inicio del análisis técnico de fondo de la pretensión del administrado. |
| **12** | `evaluacion_concluida` | Área Sustantiva | — | **SÍ** | — | Conclusión de informe técnico favorable/desfavorable y pase a Despacho de Dirección. |
| **13** | `resolucion_emitida` | Dirección General | **SÍ** | **SÍ** | — | Emisión de Resolución Directoral con firma digital PAdES y CVD verificado. |
| **14** | `notificacion_depositada` | Casilla Electrónica | **SÍ** | **SÍ** | — | Depósito formal en Casilla que activa el cómputo de notificación del Art. 20 LPAG. |
| **15** | `expediente_archivado_falta_pago` | TramiCore / Batch | — | **SÍ** | **SÍ (`ARCHIVADO_FALTA_PAGO`)** | **Cierre Definitivo:** Archivo automático al transcurrir 15 días hábiles sin pago. |
| **16** | `expediente_archivado` / `cerrado` | Archivo Central | — | **SÍ** | **SÍ (`FINALIZADO_SATISFACTORIO`)** | **Cierre Definitivo:** Conclusión satisfactoria, custodia definitiva en Archivo Central. |

---

## 3. ADAPTADOR DE WHATSAPP BUSINESS PLATFORM (SANDBOX)

### 3.1. Clasificación y Aislamiento Seguro
El servicio `WhatsAppNotificacionesService` (`backend/src/audit/whatsapp-notificaciones.service.ts`) implementa:
- **Proveedor Oficial:** `SANDBOX_WHATSAPP_CLOUD_API`.
- **Modo de Operación:** Simulación criptográfica pericial y persistencia auditada.
- **Identificador Sintético Único:** Formato `wamid.HBgM` seguido de 32 caracteres hexadecimales generados de forma determinista y única (`crypto.randomBytes(16).toString('hex').toUpperCase()`).
- **Política de Anti-Spam:** El servicio **sólo se dispara al finalizar el procedimiento** (sea satisfactorio, caducidad por falta de pago o rechazo motivado). No genera mensajes para pasos intermedios.

### 3.2. Tabla de Persistencia en PostgreSQL (`sigd_auth.notificacion_whatsapp`)
```sql
CREATE TABLE sigd_auth.notificacion_whatsapp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID REFERENCES sigd_tra.expediente(expediente_id),
  cut VARCHAR(50) NOT NULL,
  telefono VARCHAR(20) NOT NULL,
  mensaje TEXT NOT NULL,
  tipo_cierre VARCHAR(50) NOT NULL, -- 'FINALIZADO_SATISFACTORIO', 'ARCHIVADO_FALTA_PAGO', 'RECHAZADO_INADMISIBLE'
  proveedor VARCHAR(50) NOT NULL DEFAULT 'SANDBOX_WHATSAPP_CLOUD_API',
  message_id VARCHAR(100) NOT NULL UNIQUE,
  estado_envio VARCHAR(30) NOT NULL DEFAULT 'ENVIADO',
  autorizado_por_titular BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 4. EVIDENCIAS FORENSES DE NOTIFICACIONES EMITIDAS Y PERSISTIDAS

Consulta real ejecutada en la base de datos `sigd_jacobo_demo`:

```sql
SELECT cut, telefono, tipo_cierre, proveedor, message_id, estado_envio, creado_en
FROM sigd_auth.notificacion_whatsapp
ORDER BY creado_en DESC
LIMIT 4;
```

### Registros Periciales Obtenidos:

| CUT | Teléfono | Tipo de Cierre | Proveedor | Message ID (Wamid) | Estado Envío |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`EXP-2026-000212`** | 961234567 | `FINALIZADO_SATISFACTORIO` | `SANDBOX_WHATSAPP_CLOUD_API` | `wamid.HBgM0E209DEF15A0B79F1489493A6DBDF65E` | `ENVIADO` |
| **`EXP-2026-000213`** | 961234567 | `FINALIZADO_SATISFACTORIO` | `SANDBOX_WHATSAPP_CLOUD_API` | `wamid.HBgM55871961E3210CB48D37207E19A2F340` | `ENVIADO` |
| **`EXP-2026-000214`** | 961234567 | `ARCHIVADO_FALTA_PAGO` | `SANDBOX_WHATSAPP_CLOUD_API` | `wamid.HBgM2DF9BD8016ED841FE3372722B1F0CEC7` | `ENVIADO` |
| **`EXP-2026-000215`** | 999999999 | `ARCHIVADO_FALTA_PAGO` | `SANDBOX_WHATSAPP_CLOUD_API` | `wamid.HBgM351721E2BD9602F7FC78F11D00114D36` | `ENVIADO` |

---

## 5. PLANTILLAS DE MENSAJERÍA INSTITUCIONAL UTILIZADAS

### 5.1. Plantilla Cierre Satisfactorio (`FINALIZADO_SATISFACTORIO`)
> *«Estimado(a) Carlos Alberto Vásquez Mori: El IESTP "Suiza" le informa que su trámite CUT EXP-2026-000212 ha CONCLUIDO SATISFACTORIAMENTE con la emisión de la Resolución Directoral N° RD-2026-000018. Puede descargar su resolución y constancia de archivo en su Casilla Electrónica: http://localhost:5178/casilla/inbox. — Mesa de Partes IESTP Suiza»*

### 5.2. Plantilla Cierre por Falta de Pago (`ARCHIVADO_FALTA_PAGO`)
> *«Estimado(a) Carlos Alberto Vásquez Mori: El IESTP "Suiza" le informa que su trámite CUT EXP-2026-000214 ha sido ARCHIVADO POR FALTA DE PAGO al haber vencido el plazo legal improrrogable de 15 días hábiles conforme al Art. 143 del TUO de la Ley N° 27444 sin acreditar la tasa institucional. Puede consultar el detalle en: http://localhost:5178/tramites/mis-expedientes. — Mesa de Partes IESTP Suiza»*
