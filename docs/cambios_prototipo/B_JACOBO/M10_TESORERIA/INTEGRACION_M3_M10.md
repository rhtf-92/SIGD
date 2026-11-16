## Actualización tras autorización de migración13 — verificado el31/10/2026

La migración13 está APLICADA en sigd_jacobo_demo con el runner institucional, y el backend fue activado mediante el único reinicio autorizado. El flujo público ya está VERIFICADO EN NAVEGADOR REAL5178/3008, sin cuenta ni JWT, con pago explícito de ensayo, recibo, PDF, CUT, cargo y seguimiento seguro.

| Modalidad | CUT | Expediente | Recibo |
|---|---|---|---|
| Pública sin cuenta |EXP-2026-000041|99c15974-38a7-4a50-8aaf-811f168a64d1|DEMO-RC-3|
| Registrada |EXP-2026-000042|5d2cbfbe-0406-4b45-9907-a6337f1eac54|DEMO-RC-4|

Se comprobaron la devolución nueva, el cierre de caja sin diferencias, cinco PDF MinIO, dieciocho comprobaciones HTTP y dieciocho conjuntos históricos intactos. No se modificaron las18 tarifas ni SUZ26-068; no se asignaron roles a trabajadores. Todo efectivo es DEMOSTRACIÓN SIN DINERO REAL.

Pruebas de esta activación:112 backend focalizadas y19 frontend focalizadas, builds aprobados. El caso gratuito no tiene un procedimiento oficial acreditado en el catálogo actual; no se inventó una tarifa0 para afirmar un E2E institucional gratuito.

Detalle, seguridad, evidencias y límites: [ACTIVACION_13_Y_E2E_PUBLICO.md](./ACTIVACION_13_Y_E2E_PUBLICO.md). Los bloqueos de migración/activación del texto anterior están superados; se conserva ese texto como historial previo a la autorización.

---

## Estado vigente de la última fase (31/10/2026)

La ampliación pública está preparada en código, pero no activada ni verificada integralmente. No se ejecutaron migraciones ni reinicios. SUZ26-068 sigue pendiente; las otras 18 tarifas y los hechos financieros permanecen intactos. TESORERO sigue siendo el único rol administrativo vigente. Consulte [ULTIMA_FASE_CIERRE_M10.md](./ULTIMA_FASE_CIERRE_M10.md) y [FORMATO_RECIBO_INTERNO_M10.md](./FORMATO_RECIBO_INTERNO_M10.md).

El contenido siguiente es evidencia de las fases anteriores.

---

## Actualización vigente: efectivo y rol único — 31/10/2026

Esta actualización sustituye las decisiones anteriores sobre medios bancarios, cuatro roles y tarifas indiscriminadamente pendientes. Se conserva el contenido anterior como historial, no como política vigente. Fuente de cierre: [CIERRE_EFECTIVO_M10.md](./CIERRE_EFECTIVO_M10.md).

E2E real en puertos3008/5178: SUZ26-035 por124.00 → reciboDEMO-RC-2 → PDF → CUT EXP-2026-000040 → expediente 60e98f2d-e25b-4b6d-a35a-fdf51e3abf82 → cargo → historial. Omisión demo conservada, no es un pago. Operación pública sin cuenta conserva la excepción demo; orden pública sin cuenta fuera de ella continúa pendiente.

---

# Integración M3–M10

M3 y M10 consultan la misma tabla TUPA y mantienen las identidades UUID existentes. La selección consulta el catálogo financiero, informa condición e importe validado y permite generar una orden mediante el endpoint existente. La navegación abre el detalle por /tesoreria?orden=UUID, con autorización de backend. No se duplica el catálogo ni se manda el importe definitivo desde React.

## Tres condiciones

- GRATUITO: continúa sin obligación ni orden. La solicitud FUT puede reemplazar la única mención opcional de voucher cuando la gratuidad está validada. Se conservan las demás clasificaciones y requisitos obligatorios; no se desactiva el control documental.
- SUJETO_PAGO: orden propia del mismo procedimiento, PDF, revisión administrativa y pago VERIFICADO. M3 vuelve a validar y bloquea el consumo de una orden aplicada o con devolución comprometida.
- PENDIENTE_VALIDACION: no permite cobros. Fuera de demo tampoco permite radicar sin una condición financiera validada.

La disponibilidad pública, su carga y la radicación consultan la tarifa M10, no solo el texto de la descripción. Un procedimiento tarifado fuera de demo requiere gestionar la orden desde una cuenta identificada; no se asigna una cuenta genérica al público. Debe definirse institucionalmente cualquier modalidad de pago anónimo fuera de demo.

SIGD_DEMO_OMITIR_PAGO=true sigue limitado por base efectiva sigd_jacobo_demo y entorno no productivo. La excepción conserva el estado económico NO VERIFICADO y la retención posterior de RutaDoc/Despacho. No se registra dinero ni se falsea un voucher. MIGRATE_ON_BOOT=false no cambió.

## Independencia y concurrencia

La orden se aplica en la misma transacción del expediente. La idempotencia M3 se resuelve antes de consumir otra vez; el reintento recupera el cargo/CUT anterior. La selección de órdenes ahora pagina y no ignora una orden verificable situada después de las primeras 50. El filtro es por cuenta y procedimiento, y el servidor verifica de nuevo todas las relaciones.

Se comprobaron: flujo autenticado con orden, gratuidad sin orden y flujo público con reto/sesión/PDF/cargo, todos con SQL real revertido; reintento con el mismo expediente; MinIO real y asociación correcta. La prueba pública utiliza Redis real con prefijo QA y caducidad de una hora, sin alterar claves de otros formularios. No se presentaron esos CUT como expedientes persistentes.

La segunda conexión comprobó exclusión de los locks de intención y cuota. Sigue pendiente demostrar dos operaciones financieras con commits concurrentes sobre fixtures compartidas aisladas; el adaptador de integración revierte una única transacción y no acredita ese caso completo.

## Activación

La UI compatible se sirve por Vite existente. La corrección de gratuidad pública/autenticada y los nuevos endpoints backend se probaron en el harness, no se han cargado en el proceso 3008. No se reinició ni se parcheó su memoria. El runtime existente sigue sano y mantiene la excepción demo; no se declara finalizada su prueba persistente nueva.
