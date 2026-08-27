# Análisis Funcional: Trámite, Expediente y Registro (SIGD)

## 1. Objetivo
Estandarizar y definir el ciclo de vida del trámite documentario, la conformación de expedientes y la trazabilidad de asientos dentro del Sistema Integral de Gestión Documentaria (SIGD).

---

## 2. Conceptos Clave
* **Trámite:** Solicitud o gestión administrativa iniciada por un usuario interno o externo (ej. solicitud de constancia, memorándum interno, oficio institucional).
* **Expediente:** Contenedor lógico y secuencial que agrupa todos los documentos, antecedentes y asientos vinculados a un mismo trámite.
* **Documento:** Archivo o escrito individual (solicitud, oficio, informe, PDF escaneado) que respalda o conforma el expediente.
* **Asiento:** Registro inmutable y cronológico que audita cada movimiento del expediente (recepción, derivación, respuesta, notificación o archivado).

---

## 3. Actores del Sistema
* **Administrado / Solicitante:** Quien presenta la solicitud (externo o interno).
* **Mesa de Partes:** Recepciona, revisa requisitos formales y genera el registro inicial con su primer asiento.
* **Unidad Orgánica / Área Destino:** Atiende el requerimiento, emite respuesta y/o deriva el expediente.
* **Administrador:** Gestiona parámetros del sistema, correlativos y permisos.

---

## 4. Flujo Principal (Flujo Normal)
1. **Presentación:** El administrado presenta los documentos en Mesa de Partes.
2. **Validación:** Se verifican los requisitos mínimos.
3. **Apertura de Expediente:** El sistema genera el código de expediente único.
4. **Asiento Inicial (001):** Se registra la recepción formal con fecha, hora y documentos digitalizados.
5. **Derivación:** Se envía el expediente al área encargada.
6. **Atención:** El área analiza el caso, genera el documento de respuesta y actualiza el asiento.
7. **Notificación y Cierre:** Se notifica la respuesta y se archiva o cierra el expediente.

---

## 5. Flujos Excepcionales
* **Observación por Requisitos Incompletos:** Se otorga un plazo (ej. 48 horas) para subsanar. Si no se subsana, pasa a estado archivado por abandono.
* **Devolución por Competencia Indebida:** Si un área recibe un expediente por error, lo devuelve a Mesa de Partes con justificación para reasignación.
* **Desistimiento:** El administrado cancela formalmente el trámite antes de la respuesta final.
* **Anulación de Asiento:** Solo autorizada por el Administrador ante error crítico, con registro en log de auditoría.

---

## 6. Reglas de Códigos y Numeración (Propuesta)
* **Código de Expediente:** `EXP-[AÑO]-[CORRELATIVO 6 DÍGITOS]` (Ej: `EXP-2026-000001`)
* **Código de Documento:** `[TIPO_DOC]-[CORRELATIVO 4 DÍGITOS]-[AÑO]-[SIGLA_AREA]` (Ej: `OFIC-0012-2026-DSI`)
* **Numeración de Asientos:** Correlativo numérico consecutivo por cada expediente (`1, 2, 3...`).

---

## 7. Dudas Técnicas y de Negocio (Para Definir con el Equipo)
- [ ] ¿El correlativo de expediente se reinicia a `000001` cada 1 de enero o continúa de forma indefinida?
- [ ] ¿La foliación se calculará sumando páginas de PDFs automáticamente o será manual?
- [ ] ¿Se permitirá derivar un expediente a varias áreas en paralelo o solo una a la vez (secuencial)?
- [ ] ¿Los documentos requerirán firma digital criptográfica o archivo PDF adjunto estándar?