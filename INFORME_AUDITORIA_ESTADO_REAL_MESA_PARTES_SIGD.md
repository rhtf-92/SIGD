# INFORME DE AUDITORÍA DEL ESTADO REAL DE MESA DE PARTES, TRAZABILIDAD Y NOTIFICACIONES
## EVALUACIÓN EXHAUSTIVA DE ARQUITECTURA, LÓGICA DE NEGOCIO Y BRECHAS TÉCNICAS
### Sistema Integral de Gestión Documentaria — SIGD RENATO
#### Instituto de Educación Superior Tecnológico Público «Suiza» — Pucallpa, Ucayali

---

| Campo Institucional | Detalle Oficial de Auditoría |
| :--- | :--- |
| **Institución:** | IESTP Público «Suiza» (Pucallpa, Ucayali) |
| **Proyecto:** | SIGD RENATO |
| **Rama Exclusiva:** | `B_JACOBO` (HEAD: `3bcf996388632b20fce18bf7d8b82aae14cb34fc`) |
| **Base de Datos Exclusiva:** | `sigd_jacobo_demo` — PostgreSQL 18 (Puerto `5433`) |
| **Backend:** | Express / Node.js en puerto `3008` |
| **Frontend:** | React 18 / Vite SPA en puerto `5178` |
| **Expedientes Históricos Protegidos:** | `EXP-2026-000203` al `EXP-2026-000211` (**INALTERABLES**) |
| **Objetivo de Auditoría:** | Identificar discrepancias, errores de lógica, componentes desconectados e incompletos |

---

## 1. INTRODUCCIÓN

En cumplimiento del protocolo institucional de protección y auditoría del SIGD RENATO, se ha procedido a una revisión integral de código, esquemas de PostgreSQL, flujos transaccionales, Transactional Outbox y experiencia de usuario en frontend.

El propósito principal es conciliar las reglas de negocio entre **Mesa de Partes, Tesorería, IdentiCore y RutaDoc**, resolviendo de manera definitiva la contradicción detectada en la última certificación respecto al cómputo del plazo de 15 días hábiles, la atención a ciudadanos no registrados y la cobertura multicanal (Correo y WhatsApp).

---

## 2. MATRIZ DE ESTADO REAL DE COMPONENTES Y FUNCIONALIDADES

| Componente / Módulo | Funcionalidad Evaluada | Estado Técnico Real | Diagnóstico Detallado y Evidencia en Código |
| :--- | :--- | :---: | :--- |
| **`computoPlazo15Dias.service.ts`** | Cómputo de 15 días hábiles LPAG (Art. 143) | **ERROR DE LÓGICA** | **Discrepancia crítica:** En la implementación anterior, el cálculo obligaba al administrado a esperar 15 días hábiles *después de haber pagado* para poder ser recepcionado en Mesa de Partes (`nowIso >= fechaHabilitacion`). La regla institucional correcta dicta que los 15 días hábiles son el **plazo perentorio para efectuar el pago** tras la radicación. Si el ciudadano paga antes, el trámite debe habilitarse de inmediato. |
| **`derivaciones.service.ts`** | Recepción formal con Cargo QR / SHA-256 | **VERIFICADA** | Emite `CRG-2026-XXXXXX` con hash SHA-256 inmutable y URL QR pública. Bloquea si hay orden pendiente sin pago verificado. Depende de la corrección del cómputo para habilitar de inmediato al pagar. |
| **`derivaciones.service.ts`** | Rechazo formal e Inadmisibilidad (Arts. 136 y 142) | **VERIFICADA** | Endpoint `/rechazar` con Zod (`motivo`, `baseLegal`), mutación WORM, actualización a `CERRADO`/`ANULADO`, notificación en Casilla y evento Outbox. |
| **`calificacion.service.ts`** | Conformidad documental TUPA | **VERIFICADA** | Valida requisitos obligatorios (FUT, Tasa de Pago), transiciona a `EN_CALIFICACION` y registra mutación en `sigd_doc.expediente_requisito`. |
| **`mesaPartes.router.ts`** | 12 Bandejas especializadas y contadores | **VERIFICADA** | Endpoints `/contadores` (cálculo SQL agregado) y `/expedientes?bandeja=...` con paginación y joins completos a `sigd_tra`, `sigd_doc`, `sigd_rut`, `sigd_auth`. |
| **Frontend: Bandeja Mesa Partes** | Grilla de 12 bandejas con badges en vivo | **VERIFICADA** | [BandejaMesaPartesPanel.tsx](file:///c:/Users/Liz/Desktop/SIGD/SIGD/frontend/src/components/expedientes/BandejaMesaPartesPanel.tsx) integrado en [BandejaExpedientesPage.tsx](file:///c:/Users/Liz/Desktop/SIGD/SIGD/frontend/src/pages/expedientes/BandejaExpedientesPage.tsx) con conmutador funcional. |
| **Frontend: Modales y Acciones** | Recepción formal y Rechazo | **VERIFICADA** | Modales interactivos `RecepcionFormalModal` y `RechazoExpedienteModal` integrados en detalle y bandeja. |
| **`radicacionVirtual.service.ts`** | Radicación de ciudadanos registrados | **VERIFICADA** | Asignación de CUT, asiento registral, adjuntos en S3 MinIO, deduplicación advisory lock, evento outbox `radicacion_exitosa`. |
| **`radicacionVirtual.service.ts`** | Radicación de ciudadanos NO registrados | **DESCONECTADA** | `radicarPublico` inserta en `sigd_tra.radicacion_publica` y resuelve `persona_natural` sin cuenta, pero **no emitía el evento outbox `radicacion_exitosa`** en la rama pública (línea 181-195), dejando al ciudadano sin confirmación por correo. |
| **`tramites.controller.ts`** | Consulta y seguimiento de trámites públicos | **INCOMPLETA** | `GET /tramites/consulta-publica/:cut` exigía obligatoriamente la cabecera `X-SIGD-Public-Session` exacta de la sesión original del navegador. Si el ciudadano consultaba posteriormente desde otro navegador o desde el enlace de su correo, retornaba HTTP 404. Se requiere token seguro de consulta / enlace de seguimiento. |
| **`despachador-notificaciones.ts`** | Notificación por correo electrónico | **INCOMPLETA** | 1) Líneas 495-510 omitían el envío de correo si el solicitante no tenía `cuenta_usuario`, ignorando el correo declarado en `sigd_auth.persona_natural.correo`.<br>2) Faltan plantillas específicas para eventos clave: `orden_pago_generada`, `pago_confirmado`, `calificacion_iniciada`, `conformidad_documental`, `recepcion_destino`, `cierre_archivo`, `archivo_falta_pago`. |
| **Integración WhatsApp** | Notificación final multicanal | **INEXISTENTE** | No existe servicio ni adaptador para WhatsApp. Debe crearse `whatsapp-notificaciones.service.ts`, clasificado como `SANDBOX`, con registro de entrega, autorización previa y mensaje de finalización. |
| **Proceso Automático de Vencimiento** | Cierre automático por falta de pago (15 días) | **INEXISTENTE** | No existe worker programado ni endpoint que detecte órdenes vencidas a los 15 días hábiles y archive automáticamente con causal `FALTA_DE_PAGO`. |
| **Trazabilidad Unificada** | Repositorio WORM multimodular | **VERIFICADA** | `trazabilidad.repository.ts` consolida correctamente hitos de TramiCore, Tesorería, RutaDoc, DocuCore, Casilla y Archivo Central. |

---

## 3. DETALLE DE BRECHAS Y DISCREPANCIAS ENCONTRADAS

### 3.1 Error de Lógica: Plazo de Pago de 15 Días Hábiles
En la certificación anterior del expediente `EXP-2026-000211`, se implementó una verificación en `computoPlazo15Dias.service.ts` que interpretaba los 15 días hábiles como una "espera obligatoria posterior al pago".
- **Realidad Jurídica (TUO Ley N° 27444):** El administrado tiene un plazo perentorio de 15 días hábiles contados desde la radicación y generación de la orden de pago para cancelar la tasa administrativa en Tesorería.
- **Corrección Mandatoria:**
  1. Si paga dentro del plazo (p. ej., al día 1 o 5), el pago es confirmado y el expediente pasa **INMEDIATAMENTE** a Mesa de Partes para su recepción formal.
  2. Si transcurren los 15 días hábiles completos sin pago, el sistema debe ejecutar de forma automática e idempotente el cierre del trámite por `FALTA_DE_PAGO`.

### 3.2 Desconexión de Notificaciones para Ciudadanos No Registrados
En `backend/src/audit/despachador-notificaciones.ts`:
```ts
// Líneas 495-510 de la versión auditada:
if (titularExpRes.rows.length === 0) {
  // Solicitante presencial o sin cuenta registrada: registrar omisión justificada en bitácora
  await this.pool.query(... 'El expediente no cuenta con una cuenta de usuario activa para notificación por correo');
  return;
}
```
Al buscar al titular únicamente mediante `JOIN sigd_auth.cuenta_usuario`, cualquier ciudadano que tramitó sin crear cuenta quedaba excluido de los correos automáticos, a pesar de haber registrado válidamente su dirección en `sigd_auth.persona_natural.correo`.

### 3.3 Ausencia de Adaptador WhatsApp
El sistema cuenta con despacho hacia Casilla Electrónica, Correo (SMTP/Sandbox) y SSE (CoreLink), pero no poseía adaptador para WhatsApp Business Platform al finalizar el trámite.

---

## 4. PLAN DE ACCIÓN Y CORRECCIÓN ARQUITECTÓNICA

1. **Reestructuración de `computoPlazo15Dias.service.ts`:**
   - Cómputo de la fecha límite de pago a partir de la fecha de radicación oficial (`fecha_inicio_computo` = día hábil siguiente; `fecha_vencimiento_pago` = +15 días hábiles).
   - Habilitación inmediata (`habilitado = true`) al verificarse el pago en Tesorería (`estado = 'VERIFICADO'`).
   - Implementación de `procesarVencimientosPago(conexion, now)` para detectar y archivar expedientes vencidos sin pago con motivo `FALTA_DE_PAGO`.
2. **Corrección de `despachador-notificaciones.ts`:**
   - Resolución de correo sobre `sigd_auth.persona_natural.correo` cuando no exista cuenta de usuario institucional.
   - Incorporación de las 16 plantillas de correo para todas las fases públicas del procedimiento.
3. **Implementación del Adaptador WhatsApp (`whatsapp-notificaciones.service.ts`):**
   - Creación de tabla `sigd_auth.notificacion_whatsapp`.
   - Adaptador configurable clasificado rigurosamente como `SANDBOX`.
   - Envío condicionado a autorización expresa del titular al finalizar el trámite.
4. **Seguimiento Seguro para Ciudadanos No Registrados:**
   - Endpoint de consulta pública segura con token de seguimiento generado en la radicación.
5. **Certificación E2E de Nuevos Escenarios (Escenarios A a G):**
   - Ejecución con expedientes aislados nuevos (`EXP-2026-000212`, `EXP-2026-000213`, etc.) preservando intactos del 203 al 211.
