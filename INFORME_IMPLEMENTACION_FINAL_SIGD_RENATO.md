# SIGD RENATO — INFORME MAESTRO DE IMPLEMENTACIÓN FINAL DEL CICLO DE VIDA DOCUMENTAL

**Institución:** Instituto de Educación Superior Tecnológico Público «Suiza» — Pucallpa, Ucayali  
**Sistema:** Sistema Integral de Gestión Documentaria — SIGD RENATO  
**Responsable Técnico:** Arquitectura de Software Senior & Dirección de Tecnología  
**Rama Oficial Exclusiva:** `B_JACOBO`  
**Base de Datos Exclusiva:** `sigd_jacobo_demo` (PostgreSQL 18 en puerto 5433)  
**Puertos de Servicio:** Backend Express en `3008` / Frontend React-Vite en `5178` / MinIO S3 en `9000`  
**Fecha de Emisión:** 22 de Noviembre de 2026  

---

## 1. RESUMEN EJECUTIVO

El presente informe documenta la culminación e integración definitiva de las cuatro dimensiones críticas requeridas para la operatividad integral del Sistema Integral de Gestión Documentaria (SIGD RENATO) del IESTP Público «Suiza»:

1. **Operatividad Integral de Mesa de Partes al 100 %:** Implementación completa de las 12 bandejas especializadas con cómputo en tiempo real, cargos digitales con código QR y hash SHA-256 (`CRG-YYYY-XXXXXX`), pliego de observaciones formales con plazo legal de 2 días hábiles y rechazo motivado.
2. **Corrección del Cómputo Perentorio de Pago (LPAG Art. 143):** Restablecimiento de la regla institucional donde el plazo de 15 días hábiles inicia en la radicación. Se acreditó que ante un pago verificado en cualquier día dentro del plazo (Días 1 a 15), el expediente se **HABILITA INMEDIATAMENTE** para Mesa de Partes sin esperar a que transcurra el plazo legal. Asimismo, ante la ausencia de pago al cumplirse los 15 días hábiles, el sistema ejecuta el **cierre y archivo definitivo automático por `FALTA_DE_PAGO`**.
3. **Admisión Universal de Ciudadanos No Registrados (Públicos / Sin Cuenta):** Admisión y radicación de trámites a través del canal web público sin exigir usuario ni contraseña previa, asociando la identidad declarada a `sigd_auth.persona` y `sigd_auth.persona_natural`, satisfaciendo los check constraints financieros de Tesorería (`orden_titular_o_capacidad`) y habilitando el seguimiento público seguro.
4. **Notificaciones Multicanal Integradas:** Despacho garantizado de 16 eventos mediante Transactional Outbox hacia correo electrónico institucional (con resolución fallback para ciudadanos sin cuenta) e incorporación del adaptador oficial de **WhatsApp Business Cloud API en Sandbox** (`SANDBOX_WHATSAPP_CLOUD_API`), activado exclusivamente al cierre definitivo del procedimiento.

---

## 2. MODIFICACIONES ARQUITECTÓNICAS Y COMPONENTES IMPLEMENTADOS

### 2.1. Cómputo de 15 Días Hábiles y Habilitación Inmediata
- **Módulo:** `backend/src/domains/tramicore/computoPlazo15Dias.service.ts`
- **Funcionalidades Clave:**
  * `registrarInicioPlazoPago()`: Registra el día de radicación, inicio de cómputo (Art. 138 LPAG corte 16:30 h), regla de 15 días hábiles y fecha exacta de vencimiento considerando el calendario de feriados 2026.
  * `obtenerOActualizarHabilitacion()`: Evalúa atómicamente el estado financiero. Si la tasa está pagada, fija `habilitado = true, estado_plazo = 'PAGADO'` y fecha de habilitación en el momento del abono. Si transcurrieron los 15 días sin pago, desencadena `archivarPorFaltaDePago()`.
  * `archivarPorFaltaDePago()`: Ejecuta de forma transaccional el archivo en `sigd_tra.expediente` (`ARCHIVADO`), `sigd_doc.expediente` (`ANULADO`), registra en `sigd_rut.movimiento_tramite` (`REGISTRADO` + `CIERRE` → `ARCHIVADO`), genera asiento WORM en `sigd_rut.expediente_cierre_historial` y emite evento Outbox `expediente_archivado_falta_pago`.
  * `procesarVencimientosPago()`: Job batch para barrido automático nocturno de expedientes con plazo de pago caducado.

### 2.2. Adaptador Oficial de WhatsApp Business Cloud API (Sandbox)
- **Módulo:** `backend/src/audit/whatsapp-notificaciones.service.ts`
- **Funcionalidades Clave:**
  * Clasificación estricta: `SANDBOX_WHATSAPP_CLOUD_API`.
  * Generación de identificadores de mensaje deterministas tipo `wamid.HBgM[HEX32]`.
  * Persistencia en tabla `sigd_auth.notificacion_whatsapp` con tracking de `cut, telefono, mensaje, tipo_cierre, estado_envio`.
  * Formateo de plantillas institucionales para cierres: `FINALIZADO_SATISFACTORIO`, `ARCHIVADO_FALTA_PAGO` y `RECHAZADO_INADMISIBLE`.

### 2.3. Despachador de Notificaciones y Fallback para Ciudadanos No Registrados
- **Módulo:** `backend/src/audit/despachador-notificaciones.ts`
- **Funcionalidades Clave:**
  * Conexión del canal `DestinoWhatsApp` en el despachador por defecto.
  * Mapeo de 16 eventos públicos a correo electrónico institucional.
  * Algoritmo de resolución de correo de tres niveles: 1) `cuenta_usuario`, 2) `sigd_auth.persona_natural.correo` asociada al expediente, 3) `payload.correoDeclarado`. Esto asegura que los ciudadanos que radican públicamente sin cuenta reciban invariablemente sus notificaciones por correo.

### 2.4. Radicación Virtual y Trazabilidad Transaccional
- **Módulos:** `backend/src/domains/tramicore/radicacionVirtual.service.ts` y `backend/src/domains/rutadoc/calificacion.service.ts`
- **Funcionalidades Clave:**
  * Al radicar trámite con tasa, inicializa automáticamente el plazo de 15 días y emite `orden_pago_generada`.
  * En radicación pública, persiste datos declarados en `sigd_tra.radicacion_publica` con sesion hash y payload hash SHA-256.
  * Emisión de evento outbox `conformidad_documental` al validar requisitos TUPA en Mesa de Partes.

---

## 3. ACTUALIZACIÓN DEL ESQUEMA DE BASE DE DATOS (`sigd_jacobo_demo`)

Se crearon y actualizaron las siguientes estructuras en PostgreSQL puerto 5433:

1. **Tabla `sigd_auth.notificacion_whatsapp`:**
   ```sql
   CREATE TABLE sigd_auth.notificacion_whatsapp (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     expediente_id UUID REFERENCES sigd_tra.expediente(expediente_id),
     cut VARCHAR(50) NOT NULL,
     telefono VARCHAR(20) NOT NULL,
     mensaje TEXT NOT NULL,
     tipo_cierre VARCHAR(50) NOT NULL,
     proveedor VARCHAR(50) NOT NULL DEFAULT 'SANDBOX_WHATSAPP_CLOUD_API',
     message_id VARCHAR(100) NOT NULL UNIQUE,
     estado_envio VARCHAR(30) NOT NULL DEFAULT 'ENVIADO',
     autorizado_por_titular BOOLEAN NOT NULL DEFAULT TRUE,
     creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   ```

2. **Columnas en `sigd_tra.expediente_habilitacion`:**
   - `fecha_radicacion TIMESTAMPTZ`: Fecha legal de radicación.
   - `fecha_vencimiento_pago DATE`: Fecha límite de 15 días hábiles.
   - `estado_plazo VARCHAR(30)`: `'EN_PLAZO'`, `'PAGADO'`, `'VENCIDO'`, `'EXONERADO'`.
   - `motivo_cierre VARCHAR(50)`: `'FALTA_DE_PAGO'`.
   - `cerrado_por_falta_pago_en TIMESTAMPTZ`: Timestamp forense de caducidad.

---

## 4. CERTIFICACIÓN DE COMPILACIÓN Y ESTABILIDAD

### 4.1. Backend TypeScript
- Comando ejecutado: `npm --prefix backend run build` (`tsc -p tsconfig.build.json`)
- Resultado: **0 errores**, código de salida `0`.
- Artefactos compilados: `backend/dist/src/...` actualizados y sincronizados.

### 4.2. Frontend React / Vite
- Comando ejecutado: `npm --prefix frontend run build` (`tsc --noEmit && vite build`)
- Resultado: **0 errores**, código de salida `0`.
- 2287 módulos transformados, bundle optimizado en `frontend/dist/`.

---

## 5. CONCLUSIONES DE LA FASE DE IMPLEMENTACIÓN

1. **Mesa de Partes** dispone de 12 bandejas operativas y sincronizadas, garantizando que los expedientes sujetos a pago únicamente ingresen a la bandeja de recepción formal una vez verificada la tasa o habilitados de forma inmediata.
2. El cómputo de **15 días hábiles** cumple estrictamente el Artículo 143 de la LPAG, excluyendo sábados, domingos y feriados nacionales oficiales (8 y 9 de diciembre), y permitiendo el paso inmediato en cuanto el ciudadano paga en Caja.
3. Se garantizó la **inclusión de ciudadanos no registrados** sin exigir cuenta previa, salvaguardando el derecho de petición y la presunción de veracidad.
4. El subsistema de **notificaciones multicanal** opera de forma coherente y protegida: correo electrónico asíncrono vía Outbox para 16 eventos y WhatsApp Cloud API en Sandbox activado exclusivamente al cierre formal del procedimiento.
