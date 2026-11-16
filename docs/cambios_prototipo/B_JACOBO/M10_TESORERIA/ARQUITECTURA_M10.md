# Arquitectura M10

## Componentes

| Capa | Archivos y responsabilidad |
|---|---|
| HTTP | `backend/src/domains/tesoreria/tesoreria.router.ts`: JWT, RBAC efectivo, DTO estrictos, límites PDF y autorización de descarga |
| Contratos | `tesoreria.schemas.ts`: Zod, UUID, estados permitidos, importes en cadenas decimales y fechas con zona |
| Reglas | `tesoreria.rules.ts`: céntimos BigInt, saldo y máquina de estados |
| Aplicación | `tesoreria.service.ts`: tarifas, órdenes, pagos y devoluciones; concurrencia y segregación |
| Persistencia | `tesoreria.repository.ts`: transacciones, historial, bitácora y Outbox atómicos |
| Integración M3 | `tesoreria.radicacion.ts`: validación económica en la transacción existente, antes del CUT |
| Frontend | `frontend/src/pages/tesoreria/TesoreriaPage.tsx`: seis pestañas con capacidades del servidor |
| Cliente API | `frontend/src/services/tesoreriaService.ts`: tipos, PDF, SHA-256 y claves de intención aisladas por cuenta |
| Selector M3 | `frontend/src/components/tramite/OrdenPagoTramite.tsx`: selección de orden propia disponible |

Se monta `/api/v1/tesoreria` en la aplicación Express existente. No se añadieron paquetes ni servidores permanentes. PostgreSQL, Redis y MinIO conservan configuración y procesos. Las pruebas usan conexiones con cierre en `finally` y límites de consulta/conexión.

## Seguridad y transacciones

La cuenta se obtiene del JWT validado; su persona, estado, roles y permisos se consultan en PostgreSQL. No se aceptan importes, identidades ni roles del cliente para crear una orden. No existe excepción de administrador para las operaciones financieras.

Los bloqueos de fila sobre orden/pago serializan verificación, aplicación y reserva de devoluciones. Los bloqueos advisory serializan periodos tarifarios y cuotas documentales. Las referencias e intenciones cuentan además con restricciones UNIQUE. Los importes se calculan en céntimos BigInt y se almacenan NUMERIC; no se usa Float para dinero.

La aplicación de una orden y la creación del expediente son parte de la misma transacción M3. Si falla la radicación no queda una orden consumida. El historial, auditoría y evento Outbox se escriben en la misma transacción del cambio financiero. Casilla es asíncrona; su indisponibilidad no convierte una carga en pago ni elimina el hecho financiero.

## Archivos

PDF real validado con el validador existente: estructura, contenido activo, tipo, tamaño máximo de 20 MiB. El servidor calcula SHA-256, almacena en MinIO y vuelve a descargar para comprobar bytes e integridad antes de registrar el documento. Cuota por cuenta: 30 documentos y 50 MiB por hora, comprobada antes del PUT. Descargas autorizadas mediante URLs de 60 segundos; anónimo 401 y tercero 404.

Una caída SQL posterior al PUT puede dejar un objeto huérfano. No se eliminan objetos históricos automáticamente; falta un recolector institucional con periodo de retención y auditoría. Las URLs firmadas no se registran como evidencia pública.

## Activación y despliegue

Las migraciones 10 y 11 se aplicaron explícitamente solo a `sigd_jacobo_demo`, previa identidad efectiva de conexión. No se ejecutó el migrador global ni se reinició el backend. `MIGRATE_ON_BOOT=false` se conserva. El registro `public.sigd_migraciones` documenta únicamente estas dos migraciones: no se marcaron como ejecutados scripts anteriores sin evidencia.

El entorno encontrado tenía `SIGD_SAFE_BOOT=false`; se conservó, sin cambiarlo silenciosamente. El flag demo de omisión de pago pertenece al entorno heredado del proceso, no al archivo privado: cualquier activación autorizada debe preservarlo expresamente junto con `MIGRATE_ON_BOOT=false`.

Antes de producción: validar fuente tarifaria, asignar responsables con segregación, definir custodio/propietario DDL independiente de la cuenta operativa, revisar la línea base de migraciones anteriores y probar un ciclo financiero real autorizado. No basta con ejecutar el build.
