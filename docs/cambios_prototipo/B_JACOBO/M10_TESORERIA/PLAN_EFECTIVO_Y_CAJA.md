# Consolidación de efectivo y rol único (31/10/2026)

Decisión aprobada: exclusivamente efectivo y un único rol administrativo TESORERO. Sustituye las propuestas anteriores de segregación entre cuatro roles y medios bancarios; no se borra su historial.

La versión 12 será aditiva y se aplicará únicamente tras comprobar `current_database() = sigd_jacobo_demo`. Mantiene las migraciones 10 y 11 intactas. Agrega caja y movimientos inmutables, importes recibidos y vuelto, numeración interna, y procedencia documental del catálogo. Sustituye solamente las restricciones de responsables distintos que contradicen la nueva decisión. No asigna trabajadores a roles. Los roles antiguos se conservan, pero dejan de estar vigentes para autorización.

Las tarifas se importarán exclusivamente cuando coincidan código, UUID, denominación y descripción entre el catálogo PostgreSQL y el JSON de `backend/carga_tupa_suiza_2026.sql`. Se conserva el SHA-256 del PDF indicado por esa fuente y el hash del archivo importado. SUZ26-068 permanece pendiente por sus dos importes incompatibles; no se presume gratuidad. No se alteran tablas TUPA ni requisitos.

Los cobros y entregas de prueba se identificarán expresamente como demostración sin movimiento de dinero real. Los recibos internos no son comprobantes tributarios ni confirmaciones bancarias. La recepción y la devolución requieren confirmación expresa; no se infieren de adjuntar un PDF.

Las operaciones de caja, pago, devolución, historial y Outbox compartirán transacción y bloqueos. Un reintento no cambia el hecho original. No se permitirá anular un ingreso de caja para ocultar una salida: corresponde una devolución trazable.

Se comprobarán concurrencia con conexiones independientes, persistencia, MinIO, interfaz y permisos. El reinicio único de backend se reserva al final y no ejecutará migraciones automáticas. No se reiniciará ningún otro servicio.

La reversión de versión 12 solo podrá ejecutarse si no hay hechos de caja y tarifas importadas referenciadas. Nunca se eliminarán hechos financieros para permitir una reversión.
