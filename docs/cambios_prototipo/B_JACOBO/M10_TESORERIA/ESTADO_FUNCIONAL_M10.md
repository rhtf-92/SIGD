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

Implementado, activado y verificado: efectivo, caja, TESORERO y E2E con CUT EXP-2026-000040. Pendientes institucionales y límites enumerados en el cierre.

---

# Consolidación funcional M10 — 31/10/2026

## Resultado y alcance

Se continuó desde M10 activado, sin reconstruirlo. Rama B_JACOBO, HEAD bf30d8a0c85e266a86381fb10bf3740a8451c032, 292 entradas locales preexistentes preservadas. No se hicieron commits, pushes, cambios de rama, reinicios, migraciones ni DDL. Se conservaron los procesos 3008/5178, Docker y los datos históricos.

El frontend actualizado es compatible con el backend vigente. Los cambios nuevos de backend están compilados y probados con SQL/HTTP/MinIO/navegador dentro del harness de ensayo, pero **no se activaron en 3008**, porque esta fase prohíbe reiniciarlo. La UI oculta las acciones nuevas cuando el backend no anuncia su capacidad. No se hizo hot patch ni se arrancó otra instancia permanente.

| Funcionalidad | Clasificación | Evidencia y alcance |
|---|---|---|
| Catálogo vigente compartido M3/M10 | IMPLEMENTADA Y VERIFICADA | 19 IDs/códigos iguales; 19 condiciones financieras pendientes en base real |
| Clasificación financiero gratuita/tarifada/pendiente | IMPLEMENTADA Y VERIFICADA | Clasificación de UI activa desde tarifas del servidor; campo explícito nuevo del backend verificado en ensayo, sin activar |
| Pago manual, roles y segregación existentes | IMPLEMENTADA Y VERIFICADA | E2E SQL/MinIO/UI revertido; ninguna confirmación bancaria real |
| Orden desde M3 y acceso directo al detalle | IMPLEMENTADA Y VERIFICADA | API existente reutilizada; interfaz activa sin alterar portada |
| Selección de órdenes posteriores a primera página | IMPLEMENTADA Y VERIFICADA | Prueba específica de paginación y exclusión de operaciones ajenas |
| Gratuidad sin orden ni voucher | IMPLEMENTADA Y VERIFICADA | HTTP real de ensayo autenticado y público con tarifa cero sintética; SQL revertido |
| Subsanación versionada de pago/devolución | IMPLEMENTADA Y VERIFICADA | Historial existente, PDF real y reintento sin duplicación; sin sobrescribir originales. Backend nuevo sin activar |
| Constancia PDF de registro de devolución | IMPLEMENTADA Y VERIFICADA | Descarga real de navegador en ensayo y autorización; no afirma firma digital ni ejecución bancaria. Backend nuevo sin activar |
| Reintento de cierre de devolución | IMPLEMENTADA Y VERIFICADA | Corregido permiso del ejecutor, sin segunda mutación; backend nuevo sin activar |
| Saldo y elegibilidad en interfaz ciudadana | IMPLEMENTADA Y VERIFICADA | Céntimos exactos; no ofrece segunda solicitud activa ni saldo agotado |
| Casilla/Outbox y reportes | IMPLEMENTADA Y VERIFICADA | SQL real revertido, destinatario correcto e idempotencia; sin SMTP |
| Dos commits financieros concurrentes | PENDIENTE | Bloqueos comprobados con segunda conexión; no prueba completa de dos operaciones con datos compartidos confirmados |
| Tarifas oficiales listas para cobrar | BLOQUEADA | Falta fuente institucional verificable y validación independiente; cero tarifas aprobadas persistentes |
| Operación administrativa real | BLOQUEADA | Cero usuarios con roles financieros; no se asignaron sin autorización |
| Ciclo financiero persistente | BLOQUEADA | No hay una tarifa aprobada ni un abono externo autorizado; no se fabricaron pagos/devoluciones |

La etiqueta “verificada” de los cambios de backend se refiere al entorno de ensayo descrito, no a su disponibilidad actual en 3008. No se declara completo el criterio de operación institucional.

## Correcciones realizadas

1. Anexos de subsanación append-only en historial con documento propietario, clave idempotente y audit/Outbox atómicos. No nuevas tablas.
2. Constancia PDF autorizada solo cuando existe ejecución registrada y estado DEVUELTA/CERRADA; conserva la evidencia externa original.
3. Reintentos CERRADA/EN_PROCESO_DEVOLUCION usan permiso de ejecución, no de evaluación; rechazo idempotente accesible por el permiso correspondiente.
4. El reintento de registrar pago debe coincidir también en medio y fecha; no se ignoran diferencias del cuerpo.
5. Cuota de órdenes serializada por ciudadano, además del bloqueo por intención.
6. Corregido detalle que podía volver a la operación anterior al consultar otra; saldo y formulario de devolución reflejan reservas reales.
7. Gratuidad pública consulta tarifa validada M10 y no depende del texto de la descripción. La excepción demo mantiene su guardia de base efectiva.

## Integraciones y límites

M1 proporciona cuenta/persona; M2 permisos efectivos; M3 aplica orden en su transacción antes del CUT; M4 conserva expediente y retención económica demo; M5 valida/almacena PDF y SHA-256; M8 recibe Outbox/Casilla; M9 usa reportes autorizados. M6/M7 no se fuerzan: no se crean resoluciones ni firmas institucionales ficticias. No se configuró SMTP ni bancos/pasarelas/SUNAT.

Ver RESULTADOS_PRUEBAS_M10.md para resultados actuales, INTEGRACION_TUPA_M10.md para los 19 procedimientos y PENDIENTES_INSTITUCIONALES_M10.md para las condiciones de operación.
