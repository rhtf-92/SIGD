# Plan de pruebas M10

## Entornos y efectos permitidos

Identidad efectiva comprobada: `sigd_jacobo_demo`, `sigd_jacobo_user`, `172.20.0.2:5432` por puerto local 5433. Ningún script abre `sigd_prueba`. Conexiones con timeout y cierre en finally. Migraciones 10/11 explícitas, no migrador general.

`scratch/validar-m10-integracion.ts` monta routers reales en puerto efímero y utiliza SQL real mediante savepoints dentro de una transacción exterior revertida. Playwright/Edge abre Vite 5178 y reenvía únicamente API al servidor de prueba; no simula respuestas. El proceso 3008 permanece intacto. MinIO recibe PDF sintéticos rotulados DEMO; los objetos de ensayo se conservan. No hay transferencias bancarias.

`scratch/validar-m10-persistencia-documental.ts` comprueba además un documento real persistente mediante el endpoint, MinIO y PostgreSQL. No inserta pagos ficticios ni expedientes manuales.

| Caso solicitado | Comprobación |
|---|---|
| 1 Gratuito | Tarifa sintética 0.00, solo fixture revertida; nunca presume gratuidad oficial |
| 2 Procedimiento con pago | Tarifa sintética 80.00, validación separada y condición obligatoria fuera de demo |
| 3 Orden | Importe backend, referencia OP, idempotencia y propiedad |
| 4 Comprobante | PDF real, PUT/GET MinIO, SHA-256 y FK |
| 5 Verificación | Registrado no equivale a verificado; actor independiente |
| 6 Inválido | PDF incompatible rechazado, sin éxito ficticio |
| 7 Duplicado | Referencia bancaria repetida 409 |
| 8 Otro procedimiento | Orden incompatible rechazada por backend |
| 9 Sin verificar | M3 rechaza antes del CUT |
| 10 Después de verificar | M3 → expediente → CUT → cargo → historial, dentro de ROLLBACK |
| 11 Trámite equivocado | Motivo admitido, solicitud propia |
| 12 Pago duplicado | Motivo admitido por DTO; no crea un segundo abono bancario ficticio |
| 13 Observada | Transición y retorno a evaluación |
| 14 Aprobada | Aprobador independiente y permiso dedicado |
| 15 Rechazada | Transición permitida, reserva liberada |
| 16 Ejecución | Evidencia y referencia obligatorias; fixture revertida, no reembolso real |
| 17 Exceso | Saldo bloqueado y rechazo 422 |
| 18 Ajeno | Detalle/descarga 404 |
| 19 Sin permiso | Revisión/reporte 403 |
| 20 Reintentos | Idempotencia, restricciones únicas, reutilización de orden y reserva de saldo; pendiente carga concurrente multiconexión |
| 21 Historial | Consulta por titular, orden y devolución, fechas Perú |
| 22 Notificación | Outbox/Casilla real en transacción, idempotencia de despacho y SSE sin PII |

El ciclo completo también se ejecuta haciendo clic en la interfaz: ciudadano crea orden y carga PDF; otro usuario verifica; ciudadano selecciona orden en M3, adjunta PDF, radica y obtiene cargo; solicita devolución; evaluador, aprobador y ejecutor completan el circuito. Se captura escritorio y móvil. Todo hecho financiero de ese circuito se revierte.

## Regresión

Backend `npm.cmd run test:unit`; frontend `npm.cmd test`; `typecheck` y build en ambos; ESLint de archivos nuevos; `git diff --check` global y del alcance. Las pruebas unitarias no sustituyen la prueba HTTP/SQL/MinIO ni demuestran movimiento bancario real.

No ejecutar suites DB/E2E históricas sin inspeccionar su destino y sus escrituras. Para producción falta prueba de carreras con conexiones independientes, carga, conciliación/arqueo, operación bancaria autorizada, recuperación ante fallos y worker desplegado. Conservar las pruebas omitidas como omitidas.
