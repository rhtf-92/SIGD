# API M10

Base `/api/v1/tesoreria`. Todos los endpoints requieren Bearer JWT válido, cuenta activa y persona vinculada. Respuestas privadas con `Cache-Control: no-store`. Los errores siguen el middleware institucional; no se exponen SQL, claves S3 ni contraseñas.

| Método/ruta | Finalidad y autorización |
|---|---|
| GET /capacidades | Ciudadano o usuario con capacidades financieras; permisos efectivos actuales |
| GET /catalogo | Procedimientos vigentes y condición tarifaria validada disponible |
| GET /tarifas | TESORERIA_LEER; últimas 200 versiones |
| POST /tarifas | TESORERIA_TARIFA_PROPONER; procedimientoId, importe decimal, concepto, fuente, documentoId, vigenteDesde, vigenteHasta opcional |
| POST /tarifas/:id/validar | TESORERIA_TARIFA_VALIDAR; aprobar booleano; actor distinto del proponente |
| GET /ordenes | Listado propio o institucional según TESORERIA_LEER; buscar, estado y pagina; 50 elementos y hayMas |
| POST /ordenes | Ciudadano; procedimientoId y claveSolicitud UUID; identidad e importe del servidor |
| GET /ordenes/:id | Titular o TESORERIA_LEER; detalle, comprobantes, devoluciones, historial y acciones autorizadas |
| POST /pagos | Titular o TESORERIA_PAGO_REGISTRAR; ordenId, medio, entidad, referencia, fechaOperacion, documentoId |
| POST /pagos/:id/revision | TESORERIA_PAGO_VERIFICAR; estado y motivo; segregación y transición verificadas |
| POST /devoluciones | Titular; pagoId, importe decimal, motivo permitido, sustento, documentoId opcional, claveSolicitud |
| POST /devoluciones/:id/revision | Permiso según transición; estado y motivo; DEVUELTA exige entidad, referencia, fechaOperacion, documentoId y confirmaEjecucionExterna=true |
| GET /movimientos | Titular o TESORERIA_LEER; hasta 100 por página |
| GET /reportes | TESORERIA_REPORTES; desde/hasta ISO DATE, máximo 366 días; agrupación por procedimiento/estado |
| POST /documentos | PDF binario application/pdf, cabecera X-SIGD-File-Name codificada; máximo 20 MiB; devuelve id, nombre, sha256, bytes |
| GET /documentos/:id | Titular de documento/operación relacionada o TESORERIA_LEER; URL temporal autorizada, nombre y sha256 |

Los DTO son estrictos: no aceptan propiedades de rol, ciudadano o importe de orden enviadas por el cliente. Importes son cadenas con dos decimales (`"80.00"`), fechas de operación ISO con zona. La interfaz interpreta los campos de fecha/hora en America/Lima.

## Compatibilidad M3

La solicitud autenticada existente admite un campo opcional nuevo `ordenPagoId` UUID. No cambia su respuesta. El backend comprueba la orden y su consumo bajo la transacción existente. El flujo demo sin orden mantiene su aislamiento previo; fuera de demo, sin esquema financiero devuelve 503, sin tarifa validada 422 y sin pago verificado 422.

## Errores y reintentos

401 sin sesión; 403 capacidad insuficiente o identidad incompatible; 404 operación/documento no accesible; 409 referencia duplicada, orden aplicada o conflicto idempotente; 422 DTO/regla financiera incumplida; 429 cuota; 503 instalación o almacenamiento no disponible. La causa de un 409 se comunica mediante código y mensaje, no se presume duplicidad de expediente.

Orden y devolución reutilizan la clave de intención para devolver el mismo resultado ante un reintento compatible. El cliente almacena únicamente la clave UUID aislada por cuenta y operación; no guarda credenciales ni documentos. La aplicación M3 mantiene su propia idempotencia.

## Límites

No hay endpoint de cobro bancario, envío SMTP, factura SUNAT ni reasignación automática de pagos. Descargar un voucher no lo convierte en comprobante tributario. Una orden no contiene un CUT hasta que M3 radique realmente el expediente.
