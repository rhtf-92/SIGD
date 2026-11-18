# Guía de Demostración en Vivo — SIGD (Certificado de Inglés TUPA `p1-fila-06`)

**Versión base:** rama `B_GERIC`, commit `3e652ead`.
**Política de seguridad:** esta guía indica únicamente usuarios y roles institucionales de laboratorio; **no incluye contraseñas** (gestionadas en variables `LAB_*_PASSWORD` del entorno local).

---

## 1. Actores y Cuentas de Laboratorio

| Rol / Perfil | Usuario | Área / Custodia | Responsabilidad en la demostración |
| --- | --- | --- | --- |
| Mesa de Partes | `mesa_partes_demo` | `DIR` (Mesa de Partes) | Radicación presencial (`VentanillaPresencial`), derivación inicial post-pago. |
| Tesorería | `tesoreria_demo` | `DIR` (Tesorería) | Confirmación de arancel (`S/ 100.00`), emisión de recibo `REC-...` y orden `PAG-...`. |
| Director General | `director_demo` | `DIR` (Dirección General) | Derivación a `SDA`, firma DNIe de laboratorio, emisión de Resolución Directoral y archivado final. |
| Secretario Académico | `secretario_demo` | `SDA` (Subdirección Académica) | Recepción en `SDA`, asignación a especialista y elevación a firma en `DIR`. |
| Especialista Inglés | `responsable_ingles_demo` | `SDA` (`GESTOR_AREA_ACADEMICA`) | Calificación y registro del dictamen técnico en `p1-fila-06`. |
| Especialista sin asignación | `especialista_demo` | `SDA` | Demostración negativa: bloqueado en `Atender` si no está asignado y sin botón `Derivar`. |
| Ciudadano | `ciudadano_demo` | Contexto `PERSONAL` | Demostración de `/casilla` y aislamiento BOLA frente a expedientes ajenos. |

---

## 2. Recorrido Funcional Paso a Paso (Certificado de Inglés `p1-fila-06`)

### Paso 1 — Radicación en Ventanilla y Confirmación de Pago (`mesa_partes_demo` → `tesoreria_demo`)
- **Pantalla:** `/tramite/ventanilla-presencial` → `/tesoreria` → `/expedientes/:id`.
- **Acción:** Mesa de Partes registra solicitud TUPA `p1-fila-06` (*Certificado de Inglés*, costo `S/ 100.00`); Tesorería confirma el pago de la orden `PAG-...` y genera recibo `REC-...`.
- **Endpoints:**
  - `POST /api/v1/ventanilla/expedientes`
  - `POST /api/v1/tesoreria/ordenes/:id/confirmar`
- **Tablas PostgreSQL:** `sigd_tra.expediente` (`PENDIENTE_PAGO` → `REGISTRADO`), `sigd_tra.orden_pago`, `sigd_doc.expediente_tupa_vinculo`.
- **Qué explicar al profesor:** *“Un trámite TUPA arancelario nace en `PENDIENTE_PAGO`; la FSM y `evaluarElegibilidadDerivacion` bloquean cualquier derivación hasta que Tesorería confirma el pago real y emite el recibo.”*

### Paso 2 — Derivación Autorizada de DIR a SDA (`director_demo`)
- **Pantalla:** `/expedientes/:id` (botón `🚀 Derivar a SDA`).
- **Acción:** Director abre `DerivacionModal`, selecciona **Subdirección Académica (SDA)**, registra proveído y confirma.
- **Endpoint:** `POST /api/v1/expedientes/:id/movimientos/derivar`.
- **Tablas PostgreSQL:** `sigd_rut.movimiento_tramite` (`DERIVACION` → `DERIVADO`), `sigd_rut.estado_actual_expediente`.
- **Qué explicar al profesor:** *“El procedimiento `p1-fila-06` exige etapa técnica obligatoria en SDA. Director no puede emitir resolución ni sustituir la evaluación académica directamente.”*

### Paso 3 — Recepción y Asignación en SDA (`secretario_demo`)
- **Pantalla:** `/expedientes/:id` (`📥 Recepcionar Expediente` → `👤 Asignar Especialista`).
- **Acción:** Secretaría confirma recepción (`DERIVADO` → `EN_REVISION`) y asigna explícitamente a `Responsable Inglés Demo`.
- **Endpoints:**
  - `POST /api/v1/expedientes/:id/movimientos/recepcionar`
  - `POST /api/v1/expedientes/:id/asignar`
- **Tablas PostgreSQL:** `sigd_rut.movimiento_tramite` (`RECEPCION`), `sigd_rut.expediente_asignacion` (`activo = true`), `sigd_audit.evento_outbox` (`ExpedienteAsignado`).
- **Qué explicar al profesor:** *“La custodia física cambia a SDA; en este instante el botón `Enviar a Firma` permanece bloqueado por la regla de etapa académica obligatoria, y `especialista_demo` (no asignado) ve `Atender` deshabilitado.”*

### Paso 4 — Dictamen Técnico del Especialista (`responsable_ingles_demo`)
- **Pantalla:** `/expedientes` (`Mi Bandeja`) → `/expedientes/:id` (`Atender` / `📝 Registrar Dictamen Técnico`).
- **Acción:** El especialista asignado abre `AtencionModal`, registra el dictamen técnico favorable y confirma.
- **Endpoint:** `POST /api/v1/expedientes/:id/movimientos/atender`.
- **Tablas PostgreSQL:** `sigd_rut.movimiento_tramite` (registro de dictamen), `sigd_audit.evento_outbox` (`ExpedienteAtendidoTecnicamente`).
- **Qué explicar al profesor:** *“Solo el funcionario con asignación activa en el área puede dictaminar; el estado sigue en `EN_REVISION` hasta que Secretaría valide y eleve a firma.”*

### Paso 5 — Elevación a Firma en Dirección (`secretario_demo`)
- **Pantalla:** `/expedientes/:id` (`🚀 Enviar a Firma (Dirección)`).
- **Acción:** Secretaría confirma la elevación en `EnviarAFirmaModal`.
- **Endpoint:** `POST /api/v1/expedientes/:id/enviar-a-firma`.
- **Tablas PostgreSQL:** `sigd_rut.movimiento_tramite` (`ENVIAR_A_FIRMA` → `EN_FIRMA`), `sigd_rut.estado_actual_expediente` (`area_actual_id = DIR`).
- **Qué explicar al profesor:** *“Secretaría ya puede elevar porque el backend comprobó asignación activa + dictamen técnico válido; automáticamente Secretaría pierde botones operativos al trasladarse la custodia a Dirección.”*

### Paso 6 — Generación PDF Real, Firma de Laboratorio y Resolución (`director_demo`)
- **Pantalla:** `/expedientes/:id` (`Resolver con Firma` → `ResolverModal` → `Descargar` / `Ver PDF`).
- **Acción:** El modal genera el PDF A4 con escudo del IESTP Suiza, estampa QR+CVD, firma en modo laboratorio (`MockDniProvider`) y resuelve el expediente (`RD-2026-...`).
- **Endpoints:**
  - `POST /api/v1/firma/dnie/preparar`
  - `POST /api/v1/firma/dnie/verificar-y-registrar`
  - `POST /api/v1/expedientes/:id/resolver`
  - `GET /api/v1/expedientes/:id/documentos/:docId/url-archivo`
- **Tablas PostgreSQL y MinIO:** `sigd_doc.resolucion` (`NOTIFICADA`), `sigd_doc.documento_adjunto` (`sha256`, `s3_key`), `sigd_doc.firma_digital_documento` (`cvd`, `MOCK_TEST`, `SIGD TEST ROOT CA`), objetos reales en MinIO (`resoluciones/<id>.pdf` y `firmados/<id>.pdf`).
- **Qué explicar al profesor:** *“El PDF se genera con `pdf-lib`, se calcula su SHA-256 sobre bytes reales, se sube a MinIO, y la firma usa un certificado X.509 de laboratorio identificado explícitamente como prueba académica.”*

### Paso 7 — Notificación y Verificación Pública (`/consulta` y `/validador-cvd`)
- **Pantallas:** `/consulta` (público), `/casilla` (`ciudadano_demo` para validar BOLA) y `/validador-cvd`.
- **Acción:** Verificar seguimiento CUT sin exponer S3, comprobar aislamiento BOLA en Casilla y consultar el código `CVD-...` en `/validador-cvd`.
- **Endpoints:**
  - `GET /api/v1/tramites/consulta-publica/:cut?documento=...`
  - `GET /api/v1/casilla/notificaciones`
  - `GET /api/v1/validador/cvd/:cvd`
- **Tablas PostgreSQL:** `sigd_auth.notificacion_casilla` (`PUESTA_A_DISPOSICION`), `sigd_auth.notificacion_trazabilidad_evento`.
- **Qué explicar al profesor:** *“Si el expediente fue presencial sin cuenta, no se autovincula por DNI ni se publican PDFs privados en la consulta abierta por CUT; solo una cuenta vinculada y aprobada accede desde Casilla generando el acuse.”*

### Paso 8 — Archivado Institucional y Tablero Directivo (`director_demo`)
- **Pantallas:** `/expedientes/:id` (`🗄️ Archivar Expediente`) → `/reportes/dashboard`.
- **Acción:** Registrar ubicación física (`Estante`, `Balda`, `Caja`) y revisar KPIs reales MGD en el dashboard.
- **Endpoints:**
  - `POST /api/v1/expedientes/:id/movimientos/archivar`
  - `GET /api/v1/reportes/dashboard/resumen`
- **Tablas PostgreSQL:** `sigd_rut.movimiento_tramite` (`CIERRE` → `ARCHIVADO`), `sigd_tra.mv_kpis_mgd_mensual`, `sigd_tra.mv_tiempos_retencion_area`.

---

## 3. Limitaciones Técnicas Reales a Reconocer con Transparencia

1. **Firma digital de laboratorio vs. oficial:** El entorno de demostración utiliza `MockDniProvider` y certificado raíz de laboratorio (`MOCK_TEST` / `SIGD TEST ROOT CA`). El validador CVD lo rotula explícitamente como *"Firma de laboratorio verificada (pruebas / demo)"* y aclara que no reemplaza firma oficial RENIEC/INDECOPI en producción.
2. **Ciudadano presencial sin cuenta vinculada:** Se registra `PUESTA_A_DISPOSICION` en `sigd_auth.notificacion_casilla` (`usuario_id = NULL`), pero la descarga autenticada con `ACUSE_GENERADO` exige cuenta con solicitud aprobada en `solicitud_vinculacion_expediente` (o configurar `SMTP_HOST` en `DestinoEmail` para envío externo).
3. **Caso histórico `EXP-2026-000150`:** Se conservó sin adulteración como evidencia histórica de una generación antigua sin objeto MinIO y hash vacío (`e3b0c44...`); el detalle de expediente y el validador CVD ahora lo detectan y marcan como artefacto inválido.
4. **Denominación oficial del año en PDF:** El encabezado A4 institucional omite nombre del año por no existir tabla o parámetro oficial verificado para 2026 en la BD.
