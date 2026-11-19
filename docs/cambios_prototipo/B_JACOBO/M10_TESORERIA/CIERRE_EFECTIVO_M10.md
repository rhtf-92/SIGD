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

# Cierre funcional M10: efectivo, caja y TESORERO

## Actualización de última fase — 31/10/2026

Se conservaron operaciones, tarifas, roles y servicios. La ampliación de órdenes públicas sin cuenta está preparada en fuente, con pruebas focalizadas aprobadas, pero **no está activada ni verificada integralmente**: requiere autorización para la propuesta aditiva 13 y para cargar el backend, ambas operaciones prohibidas en esta intervención. No se ejecutaron migraciones ni reinicios.

SUZ26-068 sigue pendiente por dos importes sin correspondencia documental suficiente; las otras 18 tarifas se conservaron. Se verificó TESORERO como único rol administrativo vigente y se documentó el formato propuesto del recibo sin alterar los PDF existentes.

Estado, pruebas actuales y límites: [ULTIMA_FASE_CIERRE_M10.md](./ULTIMA_FASE_CIERRE_M10.md). Formato: [FORMATO_RECIBO_INTERNO_M10.md](./FORMATO_RECIBO_INTERNO_M10.md).

El contenido siguiente conserva la evidencia histórica de la fase de efectivo anterior; sus conteos y E2E no se presentan como pruebas repetidas en esta última intervención.

Fecha: 2026-10-31T13:49:47.292Z. Rama B_JACOBO. HEAD bf30d8a0c85e266a86381fb10bf3740a8451c032.

## Resultado ejecutivo

IMPLEMENTADO, ACTIVADO Y VERIFICADO EN DEMOSTRACIÓN: cobro presencial en efectivo, vuelto, recibo interno numerado, caja, devolución en efectivo, autorización mediante el rol único TESORERO y radicación autenticada con pago asociado. Los ensayos financieros están etiquetados DEMOSTRACIÓN; no se recibió ni entregó dinero real. No son pagos bancarios ni comprobantes tributarios.

El E2E utiliza Edge, el frontend existente 5178 y el backend real 3008. No intercepta ni fabrica respuestas. Generó EXP-2026-000040, expediente 60e98f2d-e25b-4b6d-a35a-fdf51e3abf82, mediante el botón Radicar Trámite. Se comprobó el cargo y su aparición en Mis trámites.

## Continuidad y protección

Estado inicial: 294 entradas locales; se conservaron. No hubo commits, pushes, cambio de rama, reconstrucción de arquitectura ni escrituras en sigd_prueba. La conexión fue comprobada mediante current_database(), usuario, host y puerto antes de aplicar DDL o fixtures. MIGRATE_ON_BOOT=false y SIGD_DEMO_OMITIR_PAGO=true permanecen activos. El archivo privado y el lanzador conservaron su SHA-256.

La activación previa validó exactamente los mismos datos antes y después. Se reinició una sola vez el backend: PID20576 → PID2752, lanzador17596 → 29184. Vite permaneció en PID8120. /health y /ready aprobados. El control inicial de ruta del lanzador abortó antes de detener procesos; se corrigió para aceptar su ruta absoluta ya verificada. No se reiniciaron Docker, PostgreSQL, Redis ni MinIO.

La verificación de seis conjuntos históricos excluye exclusivamente las tres identidades QA nuevas y el nuevo expediente de este ensayo: todas las huellas coinciden. No se modificaron expedientes ni CUT anteriores. Evidencia: verificacion-final.json. Se crearon tres identidades QA nuevas @sandbox.invalid; una posee TESORERO únicamente para pruebas. No se concedió el rol a trabajadores o ciudadanos preexistentes. Sus contraseñas son Argon2id y no aparecen en evidencias ni documentación.

## Tarifas

La importación institucional backend/carga_tupa_suiza_2026.sql contiene la fuente TUPA_2026_IESTP_Suiza.pdf y su SHA-256 377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622. Se contrastaron los 19 UUID, códigos, denominaciones, vigencias y descripciones con PostgreSQL. Hash del importador: e5b5fe021492b8985baa0915ccc61b0d18fcc39785a3fff908de7a66cac5109a. La evidencia usada es la importación documentada existente; no se afirma haber recuperado ni vuelto a leer el PDF original en esta intervención.

Se incorporaron 18 versiones financieras, sin cambiar el catálogo TUPA ni requisitos. No hay procedimiento gratuito acreditado entre esos 18; SUZ26-068 conserva dos importes/unidad por página y permanece pendiente. Las reglas de gratuidad explícita continúan cubiertas por pruebas unitarias; no se inventó un procedimiento gratuito institucional para obtener un CUT.

| Código | Importe S/ | Condición |
|---|---:|---|
| SUZ26-031 | 16.50 | SUJETO_PAGO |
| SUZ26-034 | 105.00 | SUJETO_PAGO |
| SUZ26-035 | 124.00 | SUJETO_PAGO |
| SUZ26-036 | 16.00 | SUJETO_PAGO |
| SUZ26-044 | 269.00 | SUJETO_PAGO |
| SUZ26-045 | 309.00 | SUJETO_PAGO |
| SUZ26-050 | 300.00 | SUJETO_PAGO |
| SUZ26-051 | 31.00 | SUJETO_PAGO |
| SUZ26-052 | 42.00 | SUJETO_PAGO |
| SUZ26-053 | 23.00 | SUJETO_PAGO |
| SUZ26-054 | 46.50 | SUJETO_PAGO |
| SUZ26-055 | 46.50 | SUJETO_PAGO |
| SUZ26-056 | 21.00 | SUJETO_PAGO |
| SUZ26-063 | 66.00 | SUJETO_PAGO |
| SUZ26-064 | 66.00 | SUJETO_PAGO |
| SUZ26-065 | 309.00 | SUJETO_PAGO |
| SUZ26-066 | 412.00 | SUJETO_PAGO |
| SUZ26-068 | No determinado de forma única | PENDIENTE_VALIDACION |
| SUZ26-072 | 515.00 | SUJETO_PAGO |

## Modelo y migración

Versión12_sigd_tes_efectivo.sql aplicada exclusivamente en demo, primero ensayada con ROLLBACK. Versiones10/11 intactas. Hash12: 5d73b3d6131b152e7e09df81335e344a1d8122ad766394fe106ab18204f3fa28.

- Dos tablas adicionales: sigd_tes.caja y sigd_tes.movimiento_caja. Total M10: diez tablas.
- Pago: caja, efectivo recibido, importe aplicado, vuelto, correlativo interno y marca demostración.
- Ejecución de devolución: caja y marca demostración.
- Tarifa: procedencia de catálogo con hash; permite una importación institucional sin inventar un funcionario ni un PDF adjunto. Propuestas manuales siguen requiriendo evidencia.
- Solo se sustituyeron restricciones de responsables diferentes que contradicen la decisión de rol único. La titularidad del ciudadano y las demás restricciones se conservan.
- Roles antiguos conservados, inactivos y sin asignaciones. TESORERO tiene los nueve permisos financieros. No se crearon roles nuevos.
- NUMERIC para importes; céntimos BigInt en cálculos; movimientos y recibos inmutables. Una caja global abierta como máximo. Cierre conserva contado, esperado, diferencia y observaciones.

Reversión: no hay DOWN automático que borre hechos. Con operaciones persistidas, volver al esquema anterior con segregación y sin caja destruiría o invalidaría historia. La reversión operativa requiere una versión compatible que conserve las columnas/tablas y sus registros; cualquier reversión física se bloqueará mientras existan referencias. No ejecutar el migrador general ni restaurar las versiones10/11 sobre estos hechos.

## Flujos verificados

1. API concurrente con conexiones PostgreSQL independientes: misma clave de orden → una orden; dos cobros simultáneos → un pago; dos ejecuciones simultáneas → una devolución. PagoDEMO-RC-1: recibido150.00, aplicado124.00, vuelto26.00. Devolución124.00 y cierre0.00.
2. Navegador: ciudadano → M3 → selección SUZ26-035 → ordenOP-D2280768-CAEF-46D3-92F7-229AB475D86A → TESORERO → efectivo exacto124.00 → reciboDEMO-RC-2 → PDF real → radicación → EXP-2026-000040 → cargo → Mis trámites.
3. Mismo TESORERO evalúa, aprueba y registra la entrega parcial16.50 de DEV-86358B1E-C2F2-4B81-87E0-E8203370CC63. Caja: 0.00 +124.00 -16.50 =107.50; contado107.50, diferencia0.00. Constancia descargada desde la cuenta ciudadana.
4. MinIO: recibo y PDF de expediente descargados y cotejados con SHA-256. No se simularon cargas.
5. NotiCore: 18 notificaciones financieras persistidas para el ciudadano QA y 18 eventos Outbox. SMTP permanece sin configurar.
6. Módulos previos: 23 comprobaciones HTTP finales de salud, catálogo, titularidad y barreras de acceso. Esto comprueba disponibilidad/autorización; no equivale al E2E de los nueve módulos completos.

La fecha de envío fue 2026-10-31T13:46:18.539Z; fecha legal 2026-11-02T13:00:00.000Z. El sistema conserva su regla de día no hábil: sábado31/10 → lunes02/11 a08:00 Perú. No se reemplazaron fechas reales ni se alteró la regla institucional.

## Pruebas técnicas

- Backend: 1486 aprobadas, 10 omitidas; 90 archivos aprobados, uno omitido. Log backend-unit.log.
- Frontend: 941 aprobadas, una omitida; 81 archivos aprobados. Log frontend-unit-final.log.
- Focalizadas de interfaz: 16 aprobadas. Hubo una expectativa anterior de voucher ciudadano que se adaptó al cobro exclusivo en caja; la repetición aprobó.
- TypeScript backend/frontend y builds: aprobados. Build frontend advierte bundle superior a500kB, sin fallo.
- ESLint de los cuatro archivos productivos frontend M10 modificados: aprobado. No se presenta el lint global preexistente como aprobado.
- git diff --check del alcance: aprobado. El repositorio conserva incidencias de whitespace preexistentes fuera de M10.
- E2E: sin errores JavaScript; viewport1448×1086 y móvil390×844 sin desbordamiento horizontal.

## Endpoints nuevos

- GET /api/v1/tesoreria/caja: caja, cierres y movimientos de la caja abierta, solo TESORERO.
- POST /api/v1/tesoreria/caja: apertura idempotente con saldo inicial.
- POST /api/v1/tesoreria/caja/:id/cierre: contado, diferencia y observaciones.
- POST /api/v1/tesoreria/pagos/efectivo: ordenId, efectivoRecibido, confirmaRecepcion=true. Nunca acepta importe definitivo ni identidad cliente.
- El POST/pagos legado rechaza nuevos medios bancarios. No se eliminan sus contratos o hechos históricos.
- Revisión de devolución conserva su endpoint y acepta confirmaEntregaEfectivo=true para DEVUELTA; genera recibo, salida de caja, auditoría y Outbox atómicamente.

## Archivos de esta intervención

Backend: migración12; tesoreria.efectivo.ts nuevo; service/router/rules/schemas/constancia actualizados; pruebaunitariaefectivo.spec.ts.

Frontend: CajaTesoreria.tsx y prueba nuevos; TesoreriaPage.tsx; tesoreriaService.ts; OrdenPagoTramite.tsx y sus pruebas; expectativa ciudadana de TesoreriaPage.test.tsx actualizada. No se modificaron la portada, encabezado ni otras tarjetas.

Herramientas QA y activación en scratch/m10-efectivo-*; documentos actualizados en esta carpeta. Los archivos previamente no seguidos siguen sin eliminarse.

## Evidencias

Raíz: scratch/evidencias-m10/efectivo/.

- prueba-persistente.json: identificadores, orden, recibos, devoluciones, caja, CUT y expediente; sin contraseñas ni tokens.
- migracion-aplicada.json y migracion-rollback.json: destino, hash y tarifas.
- verificacion-final.json: HTTP, MinIO, notificaciones y huellas históricas.
- red-navegador.json: rutas, métodos y estados, sin cabeceras sensibles.
- recepcion-efectivo-tesorero.png, cargo-radicacion-persistente.png, expediente-mis-tramites.png, devolucion-efectivo-tesorero.png, caja-cerrada.png, ciudadano-movil.png.
- recibo-ingreso-demo.pdf, constancia-devolucion-demo.pdf, constancia-devolucion-navegador.pdf.

Activación: scratch/evidencias-m10/efectivo-activacion-{antes,despues,proceso}.json y efectivo-backend-20261031-084357.{stdout,stderr}.log.

## Pendientes y límites de operación institucional

- PENDIENTE INSTITUCIONAL: aclarar tarifa/unidad de SUZ26-068 y designar responsable TESORERO. No se asignó ningún trabajador.
- PENDIENTE: parametrizar series/formato institucional definitivo del recibo; hoy es recibo interno numerado RC, no comprobante tributario SUNAT.
- VERIFICADO EN DEMO, NO DINERO REAL: los pagos y devoluciones registrados son ensayos marcados. No acreditan recepción o entrega real de efectivo institucional.
- PENDIENTE: orden de pago pública sin cuenta fuera de la excepción demo. La orden actual pertenece a una cuenta autenticada; el acceso público a M3 y su excepción demo siguen habilitados y no se sustituyeron por una cuenta genérica.
- PENDIENTE: ejercicio institucional de procedimiento gratuito. El catálogo actual no acredita ninguno; no se inventó gratuidad para la prueba.
- PENDIENTE DE DESPLIEGUE: endurecer privilegios del usuario propietario de tablas y definir política de ajustes de caja. No hay eliminación ni ajuste silencioso para cuadrar diferencias.
- SIN CONFIGURAR POR ORDEN: SMTP, servicios bancarios, pasarelas y comprobantes tributarios externos.

M10 queda funcional y demostrado en el entorno B_JACOBO para el flujo autenticado de efectivo. No se presenta este ensayo como puesta en operación financiera institucional ni como certificación completa de los nueve módulos.
