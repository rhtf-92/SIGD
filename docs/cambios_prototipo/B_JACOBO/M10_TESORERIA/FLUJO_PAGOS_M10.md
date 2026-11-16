## Actualización vigente: efectivo y rol único — 31/10/2026

Esta actualización sustituye las decisiones anteriores sobre medios bancarios, cuatro roles y tarifas indiscriminadamente pendientes. Se conserva el contenido anterior como historial, no como política vigente. Fuente de cierre: [CIERRE_EFECTIVO_M10.md](./CIERRE_EFECTIVO_M10.md).

Únicamente efectivo. Orden → recepción expresa por TESORERO → vuelto exacto → recibo interno numerado y MinIO → pago VERIFICADO → aplicación única en M3. El ciudadano no confirma pagos. Banco, transferencias y tarjetas no están habilitados.

---

# Flujo de pagos M10

## Flujo implementado

Cuenta ciudadana autenticada → procedimiento vigente → tarifa documentada validada por otro responsable → referencia OP anterior al CUT → registro de operación y PDF → revisión independiente → pago verificado → selección de orden en M3 → validación de titular/procedimiento/estado/saldo comprometido → radicación y aplicación atómica → CUT/cargo/historial.

El ciudadano se deriva desde JWT y PostgreSQL; nunca de un id_persona enviado por React. El backend fija importe/concepto/moneda desde la tarifa. Claves por cuenta/intención, bloqueo de orden y UNIQUE de referencias impiden duplicaciones. El reintento de pago comprueba entidad, referencia, documento, medio y fecha. No cambia la operación ya registrada para hacer coincidir otro cuerpo.

PENDIENTE es la orden sin registro. El pago pasa por REGISTRADO, EN_VERIFICACION, OBSERVADO, VERIFICADO, RECHAZADO y, cuando proceda, ANULADO. No se anula un pago aplicado o comprometido en devolución. El verificador no puede ser registrador ni titular. Los hechos originales son inmutables; las revisiones generan historial, auditoría y Outbox.

## Subsanación

POST /api/v1/tesoreria/ordenes/:id/subsanaciones admite documentoId, motivo, claveSolicitud y devolucionId opcional. Solo el titular puede adjuntar a una operación observada; el servidor valida la propiedad del PDF. Usa sigd_tes.historial existente: UUID idempotente y sobre JSON versionado dentro de motivo, limitado antes del SQL. No modifica el documento original, el importe, la referencia ni el estado. La revisión posterior sigue siendo administrativa.

La respuesta de detalle añade anexos y normaliza el texto del historial para mostrarlo de forma legible. Contrato aditivo; datos históricos libres no se interpretan como referencias. La UI solo ofrece la nueva acción si capacidades.funcionalidades.subsanacionesVersionadas=true. Esa capacidad no está anunciada por el proceso actual 3008 hasta una activación futura autorizada.

## Evidencia y limitaciones

Se comprobó el flujo con routers/SQL reales, MinIO y navegador, incluyendo observación, anexo, verificación, cargo e idempotencia. SQL revertido; no representa abono bancario. En la base real no hay tarifas aprobadas ni operaciones financieras. No se inventaron cuentas bancarias, QR ni credenciales.

La referencia bancaria se normaliza a mayúsculas y tiene unicidad por entidad. La institución debe definir una nomenclatura canónica de entidades y contrastar la operación contra su fuente bancaria; un alias distinto no sustituye una conciliación. No hay pasarela ni confirmación automática.

Un procedimiento gratuito no necesita una orden; una referencia cero que pudiera existir no crea una obligación ni admite cobro. Un procedimiento sin tarifa no puede generar cobros. La recepción demo no representa pago ni permite saltar la retención económica posterior.
