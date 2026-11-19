## Actualización vigente: efectivo y rol único — 31/10/2026

Esta actualización sustituye las decisiones anteriores sobre medios bancarios, cuatro roles y tarifas indiscriminadamente pendientes. Se conserva el contenido anterior como historial, no como política vigente. Fuente de cierre: [CIERRE_EFECTIVO_M10.md](./CIERRE_EFECTIVO_M10.md).

TESORERO evalúa, observa, aprueba/rechaza y ejecuta. Ya no se exige otro funcionario. No aprueba operaciones ciudadanas propias. DEVUELTA exige confirmación expresa de entrega y caja con fondos; salida, constancia, historial y Outbox comparten transacción. Pago original intacto.

---

# Flujo de devoluciones M10

## Ciudadano y saldo

Mis pagos → pago propio VERIFICADO → importe dentro del saldo → motivo y sustento → PDF opcional según el caso → solicitud DEV → seguimiento. Motivos: trámite equivocado, duplicidad, exceso, indebido, cancelación, error de operación y otro sustentado. No se reasigna el pago a otro trámite sin una regla institucional expresa.

El saldo se calcula en NUMERIC/céntimos exactos: total menos solicitudes no rechazadas. Las ejecutadas/cerradas continúan descontando. Se impide otra solicitud activa para el mismo pago. La UI muestra el saldo y oculta el formulario si hay una solicitud activa o saldo agotado; el servidor repite la validación bajo bloqueo. No se modifica ni elimina el pago original.

SOLICITADA → EN_EVALUACION → OBSERVADA o PENDIENTE_APROBACION → APROBADA o RECHAZADA → EN_PROCESO_DEVOLUCION → DEVUELTA → CERRADA. El evaluador, aprobador y ejecutor deben ser personas autorizadas diferentes y no el solicitante.

## Observación y subsanación

El titular puede anexar PDF/explicación a una devolución OBSERVADA mediante el endpoint de subsanación de su orden, con devolucionId. Se conserva el sustento inicial; el estado no pasa a aprobado ni devuelto automáticamente. El anexo tiene clave idempotente, historial, auditoría y evento. El evaluador retoma la evaluación por el flujo existente.

## Ejecución y constancias

DEVUELTA requiere ejecución externa efectuada, entidad, referencia, fecha, PDF y confirmación explícita del ejecutor autorizado. No es una orden de transferencia. La aprobación sola no produce dinero devuelto. El servidor conserva la evidencia y evita superar el saldo o duplicar referencia/ejecución. El cierre y sus reintentos no generan otro reembolso.

GET /api/v1/tesoreria/devoluciones/:id/constancia genera un PDF de **registro** solo si existen ejecución y estado DEVUELTA/CERRADA. Titular o permiso financiero de lectura; tercero 404. Incluye referencias e importe reales del registro, fechas Perú y documento del titular enmascarado. Header X-Content-SHA256. No escribe datos ni crea comprobantes bancarios. Se identifica expresamente como registro sin firma digital que no confirma por sí mismo una transferencia. La evidencia externa original sigue descargándose por su referencia autorizada.

La descarga real del PDF se comprobó desde navegador, en fixture SQL revertida. No se ejecutó un reembolso real ni se almacenó una devolución ficticia persistente. El backend nuevo no está activado y su botón se oculta por capacidad hasta una activación autorizada.

Casilla recibe los eventos mediante Outbox; no se configuró SMTP. La elegibilidad institucional, límites de aprobación, medio de ejecución y documentos exigibles deben ser aprobados por Dirección/Tesorería.
