# Integraciones M10

| Módulo | Integración implementada o límite |
|---|---|
| M1 IdentiCore | JWT existente, identidad por cuenta activa y persona real; ciudadano consulta solo operaciones propias |
| M2 OrganiCore | RBAC efectivo consultado en PostgreSQL, nueve permisos nuevos, cuatro roles sin asignación automática; administración existente reutilizada |
| M3 TramiCore | Selector de orden, validación económica previa al CUT y aplicación atómica a expediente; núcleo de radicación reutilizado |
| M4 RutaDoc | Conserva expediente y seguimiento existentes; la excepción demo mantiene la retención económica existente; no altera movimientos históricos |
| M5 DocuCore | Reutiliza validación PDF, configuración S3/MinIO, firma de URL e integridad SHA-256; referencias financieras en sigd_tes.documento |
| M6 Despacho | Sin dependencia obligatoria ni creación automática de resoluciones de devolución; reglas administrativas pendientes de institución |
| M7 FirmaCore | Sin firma ficticia; firma de constancias institucionales pendiente de definición y certificado válido |
| M8 NotiCore | Evento Outbox financiero → despachador existente → Casilla del titular; no requiere CUT inventado ni SMTP |
| M9 CoreLink | API de reportes financieros con capacidad dedicada; no se modificó el modelo analítico histórico ni se inventó recaudación |

## Notificación asíncrona

`tesoreria_notificacion` incluye destinatario y referencia de orden; el despachador valida la relación con una cuenta activa. Las operaciones se registran en la misma transacción que historial, auditoría y Outbox. El envío repetido se serializa por evento y no duplica Casilla. Los errores permanecen visibles para el worker; no se marcan eventos históricos procesados artificialmente.

La referencia OP ocupa el identificador documental de la comunicación y el CUT permanece NULL cuando todavía no hay expediente. Los eventos documentales existentes conservan su contrato. El SSE financiero solo emite una invalidación genérica de Casilla: no difunde importes, identidad, documentos ni referencias a todos los clientes del canal. El titular vuelve a consultar su casilla por el endpoint autorizado.

Se generan mensajes según cambio de estado del pago/devolución. El código de prueba despachó eventos reales en una transacción revertida y comprobó lectura por el titular y repetición sin duplicados. Esto no prueba que el proceso worker actualmente activo haya procesado M10: requiere activar el backend y revisar su despliegue autorizado.

## Orden de activación recomendado

1. Conservar la base demo, las banderas actuales y migraciones automáticas desactivadas.
2. Activar código backend únicamente mediante reinicio controlado autorizado del proceso 3008; no tocar frontend, Redis, PostgreSQL ni MinIO.
3. Confirmar salud, disponibilidad y JWT; comprobar M10 sin permisos administrativos implícitos.
4. Dirección autoriza cuentas con funciones segregadas desde M2; no se asignaron durante esta intervención.
5. Tesorería carga la fuente tarifaria verificable; segundo responsable la valida.
6. Probar un pago real autorizado y su correspondencia bancaria; verificar y radicar con esa orden sin duplicar expedientes.
7. Solo si procede institucionalmente, tramitar una devolución real y registrar la referencia y constancia auténticas.

No se configuró SMTP. No se integraron SUNAT, BN, Niubiz, Izipay ni Págalo.pe. El registro manual exige respaldo externo; la ejecución de devolución depende de un medio institucional autorizado.
